# Test accounts (local testing only)

These accounts are created when the LMS starts with an empty data folder on your own computer.
They are not shown on the sign-in page and not printed in the console.

| Role | Email | Password |
|---|---|---|
| Instructor | instructor@usaii.org | `VJ%NTj+R%zgvTp3wmc` |
| Learner | alex.rivera@enterprise.com | `7rcV%5qXmNTFttj_Dw` |
| Learner (first-time goal setup) | jordan.lee@enterprise.com | `Vv_rG%?6Jyj78bt+Kx` |
| Learner | morgan.chen@enterprise.com | `&8gr-?MB?eA!7t2ztK` |

Choose the matching tab (Learner or Instructor) on the sign-in page; the other tab refuses the account.

**Upgrading from 5.5:** your data is kept. Starter accounts that still had the old published passwords
(`Learner@2026`, `Instructor@2026`) are switched to the passwords above on first start; anyone who
had already chosen their own password keeps it. A backup of the old data file is saved in `data/`.

**On a hosted site** these passwords are not used. See DEPLOY.md: set `SEED_INSTRUCTOR_PASSWORD` and
`SEED_LEARNER_PASSWORD`, or read the generated `data/initial-credentials.txt` once and delete it.

Do not share this file outside the test team. Change the passwords before any real learner signs in.
