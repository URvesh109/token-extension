#!/usr/bin/env bash
set -euo pipefail

solana airdrop --keypair keypairs/admin.json 100
solana airdrop --keypair keypairs/receiver.json 100
solana airdrop --keypair keypairs/receiver2.json 100
solana airdrop --keypair keypairs/receiver3.json 100

anchor build --arch sbf

anchor deploy \
  -p token_extension \
  --program-keypair keypairs/deploy-key-token-extension.json
