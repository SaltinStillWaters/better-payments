#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Escrow(u64),
    EscrowCounter,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Created,
    Funded,
    Released,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub id: u64,
    pub seller: Address,
    pub buyer: Address,
    pub amount: i128,
    pub memo: String,
    pub status: EscrowStatus,
    pub created_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EscrowError {
    EscrowNotFound = 1,
    InvalidAmount = 2,
    Unauthorized = 3,
    AlreadyFunded = 4,
    AlreadyReleased = 5,
    NotFunded = 6,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowCreated {
    pub id: u64,
    pub seller: Address,
    pub buyer: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowFunded {
    pub id: u64,
    pub buyer: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowReleased {
    pub id: u64,
    pub seller: Address,
    pub amount: i128,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn create_escrow(
        env: Env,
        seller: Address,
        buyer: Address,
        amount: i128,
        memo: String,
    ) -> Result<u64, EscrowError> {
        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        seller.require_auth();

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowCounter)
            .unwrap_or(0);
        let id = counter + 1;

        let escrow = Escrow {
            id,
            seller: seller.clone(),
            buyer: buyer.clone(),
            amount,
            memo,
            status: EscrowStatus::Created,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        env.storage().instance().set(&DataKey::EscrowCounter, &id);

        env.storage().instance().extend_ttl(100, 518400);

        EscrowCreated {
            id,
            seller,
            buyer,
            amount,
        }
        .publish(&env);

        Ok(id)
    }

    pub fn fund_escrow(env: Env, id: u64) -> Result<(), EscrowError> {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::EscrowNotFound)?;

        escrow.buyer.require_auth();

        if escrow.status == EscrowStatus::Released {
            return Err(EscrowError::AlreadyReleased);
        }

        if escrow.status == EscrowStatus::Funded {
            return Err(EscrowError::AlreadyFunded);
        }

        let sac = Self::xlm_sac_client(&env);
        sac.transfer(
            &escrow.buyer,
            &env.current_contract_address(),
            &escrow.amount,
        );

        escrow.status = EscrowStatus::Funded;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

        EscrowFunded {
            id,
            buyer: escrow.buyer,
            amount: escrow.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn release_escrow(env: Env, id: u64) -> Result<(), EscrowError> {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::EscrowNotFound)?;

        escrow.buyer.require_auth();

        if escrow.status == EscrowStatus::Released {
            return Err(EscrowError::AlreadyReleased);
        }

        if escrow.status != EscrowStatus::Funded {
            return Err(EscrowError::NotFunded);
        }

        let sac = Self::xlm_sac_client(&env);
        sac.transfer(
            &env.current_contract_address(),
            &escrow.seller,
            &escrow.amount,
        );

        escrow.status = EscrowStatus::Released;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

        EscrowReleased {
            id,
            seller: escrow.seller,
            amount: escrow.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn get_escrow(env: Env, id: u64) -> Option<Escrow> {
        env.storage().persistent().get(&DataKey::Escrow(id))
    }

    fn xlm_sac_client(env: &Env) -> token::Client<'_> {
        let sac_address = Address::from_string(
            &String::from_str(
                env,
                "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            ),
        );
        token::Client::new(env, &sac_address)
    }
}
