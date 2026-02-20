# Security and Licensing Notes

## Security

Prefer repos that:
- Build from source or publish signed releases
- Provide checksums for binaries
- Use GitHub Actions and pinned dependencies
- Have a SECURITY.md or disclose process

If the tool touches credentials:
- Prefer OAuth or token-based auth stored in keychain/credential manager
- Avoid tools that ask for passwords in plain text

## Licensing

- MIT/Apache-2.0/BSD: generally easiest to adopt
- GPL/LGPL: may restrict redistribution and bundling, especially for commercial use
- No license: treat as “all rights reserved” and avoid recommending

Always state the license briefly in recommendations.
