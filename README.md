# Token Extension

This program demonstrates the usage of Token-2022 extension using [Anchor CPI](https://www.anchor-lang.com/docs/cross-program-invocations). For more details, visit [Extension Guide page](https://spl.solana.com/token-2022/extensions#extensions).

## Note

- **Confidential transfer extension work is in progress.**
- `initialize_group` and `initialize_member` instructions are not working therefore the code is commented out.
- **This code is unaudited. Use at your own risk.**

# Setup

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool)
- [Spl-token](https://spl.solana.com/token#setup)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- [Yarn](https://yarnpkg.com/getting-started/install)

### Required Version

- rustc 1.75.0
- solana-cli 1.18.0
- anchor 0.29.0
- node v20.11.0
- yarn 1.22.19

# Testing on Localnet

- ### Steps to test the program:

```bash
   $ ./test-validator.sh # new terminal
   $ yarn or npm install
   $ anchor run all # please check the available individual test-cases in Anchor.toml
```

## Learning Resources

- [Anchor](https://www.anchor-lang.com/)
- [SolDev](https://www.soldev.app/)
- [SolanaCookbook](https://solanacookbook.com/#contributing)
- [Solana Developers Guides](https://solana.com/developers/guides)
- [Helius Dev](https://www.helius.dev/blog)
