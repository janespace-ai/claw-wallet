## ADDED Requirements

### Requirement: Desktop computes USD for signing allowance

The desktop wallet SHALL compute the US dollar value used for per-transaction and daily signing limits from on-chain transaction fields and local `PriceService` data. It SHALL NOT use Agent-supplied fields that represent token amount as a USD estimate for this purpose.

#### Scenario: ETH transfer uses wei and spot price

- **WHEN** a `sign_transaction` request carries native ETH transfer fields (`value` in wei) and token identifies as ETH
- **THEN** the desktop SHALL convert wei to ETH units, fetch the ETH USD price via `PriceService`, and multiply to obtain `estimatedUsdForPolicy`

#### Scenario: ERC-20 transfer decodes calldata

- **WHEN** a `sign_transaction` request carries ERC-20 `transfer` calldata (`0xa9059cbb` selector) and a known `token` symbol with configured decimals
- **THEN** the desktop SHALL decode the transferred amount, convert to human token units, fetch the token USD price, and multiply to obtain `estimatedUsdForPolicy`

### Requirement: No silent sign without a usable price

The desktop wallet SHALL NOT auto-approve (`sign_transaction` silent sign) when it cannot obtain a usable USD price for the transferred asset. The user MUST still be able to approve manually after reviewing the request.

#### Scenario: Price fetch misses token

- **WHEN** `PriceService` returns no positive USD price for the asset symbol needed for the transaction
- **THEN** silent auto-sign for that `sign_transaction` SHALL be disabled and the approval flow SHALL require manual confirmation

#### Scenario: Non-transaction signing unchanged

- **WHEN** the method is not `sign_transaction` (e.g. `sign_message`)
- **THEN** the price-availability gate for silent signing SHALL NOT apply in a way that blocks the existing budget rules for those methods
