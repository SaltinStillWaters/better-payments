#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Escrow(u64),
    EscrowCounter,
    Admin,
    TimeoutSeconds,
    Token,
    Paused,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Created,
    Funded,
    Released,
    Refunded,
    Disputed,
    Resolved,
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
    pub timeout_at: u64,
    pub arbitrator: Option<Address>,
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
    RefundNotAvailable = 7,
    AlreadyDisputed = 8,
    NotDisputed = 9,
    AlreadyRefunded = 10,
    ContractPaused = 11,
    NotInitialized = 12,
    AlreadyInitialized = 13,
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

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowRefunded {
    pub id: u64,
    pub buyer: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowDisputed {
    pub id: u64,
    pub caller: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowResolved {
    pub id: u64,
    pub to_seller: bool,
    pub resolver: Address,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// One-time initialization. Must be called before any other state-changing method.
    pub fn initialize(
        env: Env,
        admin: Address,
        timeout_seconds: u64,
        xlm_sac_address: Address,
    ) -> Result<(), EscrowError> {
        if Self::is_initialized(&env) {
            return Err(EscrowError::AlreadyInitialized);
        }

        if timeout_seconds == 0 {
            return Err(EscrowError::InvalidAmount);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TimeoutSeconds, &timeout_seconds);
        env.storage()
            .instance()
            .set(&DataKey::Token, &xlm_sac_address);
        env.storage().instance().set(&DataKey::Paused, &false);

        env.storage().instance().extend_ttl(100, 518400);

        Ok(())
    }

    pub fn create_escrow(
        env: Env,
        seller: Address,
        buyer: Address,
        amount: i128,
        memo: String,
        arbitrator: Option<Address>,
    ) -> Result<u64, EscrowError> {
        Self::ensure_initialized(&env)?;
        Self::ensure_not_paused(&env)?;

        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        seller.require_auth();

        let timeout_seconds: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TimeoutSeconds)
            .ok_or(EscrowError::NotInitialized)?;

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowCounter)
            .unwrap_or(0);
        let id = counter + 1;
        let created_at = env.ledger().timestamp();

        let escrow = Escrow {
            id,
            seller: seller.clone(),
            buyer: buyer.clone(),
            amount,
            memo,
            status: EscrowStatus::Created,
            created_at,
            timeout_at: created_at.saturating_add(timeout_seconds),
            arbitrator,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);
        env.storage().instance().set(&DataKey::EscrowCounter, &id);

        env.storage().instance().extend_ttl(100, 518400);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

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
        Self::ensure_initialized(&env)?;
        Self::ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::EscrowNotFound)?;

        escrow.buyer.require_auth();

        if matches!(escrow.status, EscrowStatus::Released) {
            return Err(EscrowError::AlreadyReleased);
        }

        if matches!(
            escrow.status,
            EscrowStatus::Funded | EscrowStatus::Disputed | EscrowStatus::Resolved
        ) {
            return Err(EscrowError::AlreadyFunded);
        }

        if matches!(escrow.status, EscrowStatus::Refunded) {
            return Err(EscrowError::AlreadyRefunded);
        }

        let token = Self::token_client(&env)?;
        let contract_address = env.current_contract_address();

        // Pull funds from buyer into escrow contract.
        token.transfer(&escrow.buyer, &contract_address, &escrow.amount);

        escrow.status = EscrowStatus::Funded;

        let timeout_seconds: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TimeoutSeconds)
            .ok_or(EscrowError::NotInitialized)?;
        escrow.timeout_at = env.ledger().timestamp().saturating_add(timeout_seconds);

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

        EscrowFunded {
            id,
            buyer: escrow.buyer.clone(),
            amount: escrow.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn release_escrow(env: Env, id: u64) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;
        Self::ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::EscrowNotFound)?;

        escrow.buyer.require_auth();

        if matches!(escrow.status, EscrowStatus::Released) {
            return Err(EscrowError::AlreadyReleased);
        }

        if !matches!(escrow.status, EscrowStatus::Funded) {
            return Err(EscrowError::NotFunded);
        }

        escrow.status = EscrowStatus::Released;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);

        let token = Self::token_client(&env)?;
        let contract_address = env.current_contract_address();
        token.transfer(&contract_address, &escrow.seller, &escrow.amount);

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

        EscrowReleased {
            id,
            seller: escrow.seller.clone(),
            amount: escrow.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn refund_escrow(env: Env, id: u64) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;
        Self::ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::EscrowNotFound)?;

        escrow.buyer.require_auth();

        if !matches!(escrow.status, EscrowStatus::Funded) {
            return Err(EscrowError::RefundNotAvailable);
        }

        let now = env.ledger().timestamp();
        if now < escrow.timeout_at {
            return Err(EscrowError::RefundNotAvailable);
        }

        escrow.status = EscrowStatus::Refunded;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);

        let token = Self::token_client(&env)?;
        let contract_address = env.current_contract_address();
        token.transfer(&contract_address, &escrow.buyer, &escrow.amount);

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

        EscrowRefunded {
            id,
            buyer: escrow.buyer.clone(),
            amount: escrow.amount,
        }
        .publish(&env);

        Ok(())
    }

    pub fn dispute_escrow(env: Env, caller: Address, id: u64) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;
        Self::ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::EscrowNotFound)?;

        if caller != escrow.buyer && caller != escrow.seller {
            return Err(EscrowError::Unauthorized);
        }
        caller.require_auth();

        if matches!(escrow.status, EscrowStatus::Disputed) {
            return Err(EscrowError::AlreadyDisputed);
        }

        if !matches!(escrow.status, EscrowStatus::Funded) {
            return Err(EscrowError::NotFunded);
        }

        escrow.status = EscrowStatus::Disputed;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

        EscrowDisputed {
            id,
            caller: caller.clone(),
        }
        .publish(&env);

        Ok(())
    }

    pub fn resolve_dispute(
        env: Env,
        resolver: Address,
        id: u64,
        to_seller: bool,
    ) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;
        Self::ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(EscrowError::EscrowNotFound)?;

        let is_admin = resolver == Self::admin(env.clone())?;
        let is_arbitrator = escrow
            .arbitrator
            .as_ref()
            .map(|a| a == &resolver)
            .unwrap_or(false);

        if !is_admin && !is_arbitrator {
            return Err(EscrowError::Unauthorized);
        }
        resolver.require_auth();

        if !matches!(escrow.status, EscrowStatus::Disputed) {
            return Err(EscrowError::NotDisputed);
        }

        escrow.status = EscrowStatus::Resolved;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(id), &escrow);

        let token = Self::token_client(&env)?;
        let contract_address = env.current_contract_address();
        let destination = if to_seller {
            &escrow.seller
        } else {
            &escrow.buyer
        };
        token.transfer(&contract_address, destination, &escrow.amount);

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(id), 100, 518400);

        EscrowResolved {
            id,
            to_seller,
            resolver: resolver.clone(),
        }
        .publish(&env);

        Ok(())
    }

    // Admin functions

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;

        let admin = Self::admin(env.clone())?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage().instance().extend_ttl(100, 518400);

        Ok(())
    }

    pub fn set_timeout(env: Env, seconds: u64) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;

        if seconds == 0 {
            return Err(EscrowError::InvalidAmount);
        }

        let admin = Self::admin(env.clone())?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::TimeoutSeconds, &seconds);
        env.storage().instance().extend_ttl(100, 518400);

        Ok(())
    }

    pub fn set_token(env: Env, token_address: Address) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;

        let admin = Self::admin(env.clone())?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::Token, &token_address);
        env.storage().instance().extend_ttl(100, 518400);

        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;

        let admin = Self::admin(env.clone())?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().extend_ttl(100, 518400);

        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), EscrowError> {
        Self::ensure_initialized(&env)?;

        let admin = Self::admin(env.clone())?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().extend_ttl(100, 518400);

        Ok(())
    }

    // Read-only functions

    pub fn get_escrow(env: Env, id: u64) -> Option<Escrow> {
        env.storage().persistent().get(&DataKey::Escrow(id))
    }

    pub fn admin(env: Env) -> Result<Address, EscrowError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)
    }

    pub fn timeout_seconds(env: Env) -> Result<u64, EscrowError> {
        env.storage()
            .instance()
            .get(&DataKey::TimeoutSeconds)
            .ok_or(EscrowError::NotInitialized)
    }

    pub fn token_address(env: Env) -> Result<Address, EscrowError> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(EscrowError::NotInitialized)
    }

    pub fn is_paused(env: Env) -> Result<bool, EscrowError> {
        Self::ensure_initialized(&env)?;
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false))
    }

    // Internal helpers

    fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    fn ensure_initialized(env: &Env) -> Result<(), EscrowError> {
        if !Self::is_initialized(env) {
            return Err(EscrowError::NotInitialized);
        }
        Ok(())
    }

    fn ensure_not_paused(env: &Env) -> Result<(), EscrowError> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(EscrowError::ContractPaused);
        }
        Ok(())
    }

    fn token_client(env: &Env) -> Result<token::Client<'_>, EscrowError> {
        let token_address = Self::token_address(env.clone())?;
        Ok(token::Client::new(env, &token_address))
    }
}

#[cfg(test)]
mod test;
