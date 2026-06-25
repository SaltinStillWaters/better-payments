#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, token, Address, Env};

use escrow::{EscrowContract, EscrowContractClient};

fuzz_target!(|data: &[u8]| {
    if data.len() < 16 {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);

    let token_address = env.register_stellar_asset_contract(admin.clone());
    let token_client = token::Client::new(&env, &token_address);
    let sac = token::StellarAssetClient::new(&env, &token_address);

    client.initialize(&admin, &1_000, &token_address);

    // Fund buyer.
    let fund_amount = i128::from_le_bytes(data[0..16].try_into().unwrap()).abs();
    if fund_amount <= 0 {
        return;
    }
    sac.mint(&buyer, &fund_amount);

    // Create a single escrow.
    let escrow_amount = fund_amount / 2;
    if escrow_amount <= 0 {
        return;
    }

    let id = client.create_escrow(
        &seller,
        &buyer,
        &escrow_amount,
        &soroban_sdk::String::from_str(&env, "fuzz"),
        &None,
    );

    // Fund it.
    client.fund_escrow(&id);

    // Invariant: contract balance should equal the escrow amount while active.
    let contract_balance: i128 = token_client.balance(&contract_id);
    assert_eq!(contract_balance, escrow_amount);
});
