# Security policy

The program will hold user funds in USDC, so we take reports seriously.

- Report privately through GitHub: **Security → Report a vulnerability** on this repository.
  Please do not open public issues for security problems.
- Include the affected component (program, engine, verify CLI), steps to reproduce and impact.
- We aim to acknowledge reports within 72 hours and will keep you updated until a fix ships.

Scope today: everything in this repository. The program is not deployed to mainnet yet.

Before mainnet launch:

- every instruction gets tests for its success path and for each check that can reject it;
- invariant fuzzing (Trident) runs random sequences of instructions and checks that the funds of
  every pool always add up;
- two independent security reviews run, and their findings and fixes are published here;
- builds are verifiable, so anyone can match the deployed program to this source;
- the program enforces beta limits on entry fees and pool sizes, and if a pool is not locked or
  settled in time, anyone can cancel it and every player can take their entry back;
- a bug bounty opens.

An external audit is not planned before the public launch; we will revisit it after launch.
