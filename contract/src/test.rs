use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env, String,
};

use crate::{EscrowContract, EscrowContractClient, EscrowError, EscrowStatus};

fn setup() -> (
    Env,
    EscrowContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_client = token::Client::new(&env, &token_address);
    let sac = token::StellarAssetClient::new(&env, &token_address);

    client.initialize(&admin, &1_000, &token_address);

    // Fund buyer with tokens for escrow funding.
    sac.mint(&buyer, &10_000_000_000);

    (
        env,
        client,
        admin,
        seller,
        buyer,
        arbitrator,
        token_client,
        sac,
    )
}

#[test]
fn test_initialize() {
    let (_env, client, admin, ..) = setup();

    assert_eq!(client.admin(), admin);
    assert_eq!(client.timeout_seconds(), 1_000);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn test_initialize_twice_fails() {
    let (_env, client, admin, _seller, _buyer, _arbitrator, _token_client, _sac) = setup();
    let token_address = client.token_address();
    client.initialize(&admin, &1_000, &token_address);
}

#[test]
fn test_create_escrow() {
    let (env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    assert_eq!(id, 1);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.seller, seller);
    assert_eq!(escrow.buyer, buyer);
    assert_eq!(escrow.amount, amount);
    assert_eq!(escrow.memo, memo);
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.arbitrator, Some(arbitrator));
}

#[test]
fn test_fund_and_release() {
    let (_env, client, _admin, seller, buyer, arbitrator, token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    let contract_address = client.address.clone();

    client.fund_escrow(&id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Funded);
    assert_eq!(token_client.balance(&contract_address), amount);

    client.release_escrow(&id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Released);
    assert_eq!(token_client.balance(&seller), amount);
    assert_eq!(token_client.balance(&contract_address), 0);
}

#[test]
fn test_refund_after_timeout() {
    let (env, client, _admin, seller, buyer, arbitrator, token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    client.fund_escrow(&id);

    // Refund before timeout should fail.
    assert_eq!(
        client.try_refund_escrow(&id),
        Err(Ok(EscrowError::RefundNotAvailable))
    );

    // Advance ledger timestamp past timeout.
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 2_000,
        protocol_version: 26,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 100,
        min_persistent_entry_ttl: 100,
        max_entry_ttl: 1_000_000,
    });

    client.refund_escrow(&id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Refunded);
    assert_eq!(token_client.balance(&buyer), 10_000_000_000);
}

#[test]
fn test_dispute_resolve_to_seller() {
    let (_env, client, _admin, seller, buyer, arbitrator, token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    client.fund_escrow(&id);
    client.dispute_escrow(&buyer, &id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Disputed);

    client.resolve_dispute(&arbitrator, &id, &true);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(token_client.balance(&seller), amount);
}

#[test]
fn test_dispute_resolve_to_buyer() {
    let (_env, client, admin, seller, buyer, arbitrator, token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    client.fund_escrow(&id);
    client.dispute_escrow(&seller, &id);
    client.resolve_dispute(&admin, &id, &false);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(token_client.balance(&buyer), 10_000_000_000);
}

#[test]
fn test_unauthorized_dispute_resolution() {
    let (_env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let attacker = Address::generate(&client.env);
    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    client.fund_escrow(&id);
    client.dispute_escrow(&buyer, &id);

    assert_eq!(
        client.try_resolve_dispute(&attacker, &id, &true),
        Err(Ok(EscrowError::Unauthorized))
    );
}

#[test]
fn test_double_fund_fails() {
    let (_env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    client.fund_escrow(&id);
    assert_eq!(
        client.try_fund_escrow(&id),
        Err(Ok(EscrowError::AlreadyFunded))
    );
}

#[test]
fn test_release_before_fund_fails() {
    let (_env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    assert_eq!(
        client.try_release_escrow(&id),
        Err(Ok(EscrowError::NotFunded))
    );
}

#[test]
fn test_refund_after_release_fails() {
    let (env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    client.fund_escrow(&id);
    client.release_escrow(&id);

    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 2_000,
        protocol_version: 26,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 100,
        min_persistent_entry_ttl: 100,
        max_entry_ttl: 1_000_000,
    });

    assert_eq!(
        client.try_refund_escrow(&id),
        Err(Ok(EscrowError::RefundNotAvailable))
    );
}

#[test]
fn test_pause_blocks_operations() {
    let (_env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    client.pause();
    assert!(client.is_paused());

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    assert_eq!(
        client.try_create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()),),
        Err(Ok(EscrowError::ContractPaused))
    );

    client.unpause();
    assert!(!client.is_paused());

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));
    client.fund_escrow(&id);
}

#[test]
fn test_admin_functions() {
    let (_env, client, _admin, _seller, _buyer, _arbitrator, _token_client, _sac) = setup();

    let new_admin = Address::generate(&client.env);
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);

    client.set_timeout(&2_000);
    assert_eq!(client.timeout_seconds(), 2_000);

    let new_token = client
        .env
        .register_stellar_asset_contract_v2(new_admin.clone())
        .address();
    client.set_token(&new_token);
    assert_eq!(client.token_address(), new_token);
}

#[test]
fn test_zero_amount_fails() {
    let (_env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let memo = String::from_str(&client.env, "Test escrow");

    assert_eq!(
        client.try_create_escrow(&seller, &buyer, &0, &memo, &Some(arbitrator.clone()),),
        Err(Ok(EscrowError::InvalidAmount))
    );
}

#[test]
fn test_dispute_non_funded_escrow_fails() {
    let (_env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    assert_eq!(
        client.try_dispute_escrow(&buyer, &id),
        Err(Ok(EscrowError::NotFunded))
    );
}

#[test]
fn test_resolve_without_dispute_fails() {
    let (_env, client, _admin, seller, buyer, arbitrator, _token_client, _sac) = setup();

    let amount: i128 = 1_000_000_000;
    let memo = String::from_str(&client.env, "Test escrow");

    let id = client.create_escrow(&seller, &buyer, &amount, &memo, &Some(arbitrator.clone()));

    client.fund_escrow(&id);

    assert_eq!(
        client.try_resolve_dispute(&arbitrator, &id, &true),
        Err(Ok(EscrowError::NotDisputed))
    );
}
