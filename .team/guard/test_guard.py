import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("guard", pathlib.Path(__file__).with_name("guard.py"))
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

BLOCKED = [
    "rm -rf apps/admin-dashboard/src",
    "rm -f services/identity/src/app.ts",
    "cd x && rm -rf ~/Developer",
    "rm -rf /Users/jcgm/Developer/Resto",
    "git reset --hard HEAD~1",
    "git clean -fd",
    "git checkout -- .",
    "git checkout .",
    "git restore apps/",
    "git push --force origin main",
    "git push -f",
    "git branch -D feature/x",
    "git stash drop",
    "find . -name '*.log' -delete",
    "ls | xargs rm",
    "docker compose down -v",
    "docker volume prune",
    "docker system prune -af",
    "psql -c 'DROP DATABASE resto_identity'",
    "psql -c 'TRUNCATE TABLE \"User\"'",
    "psql -c 'delete from \"User\"'",
    "pnpm exec prisma migrate reset",
    "sudo rm -rf /",
    "bash <<'EOF'\nrm -rf apps\nEOF",
    "git commit -m x <<EOF\nok\nEOF\ngit reset --hard",
    "git commit -m ok ; git reset --hard",
    "echo hola && git push --force",
]

ALLOWED = [
    "rm -rf apps/admin-dashboard/.next apps/client-pwa/.next",
    "rm -rf node_modules",
    "rm -rf /private/tmp/claude-501/scratch",
    "rm ./.sandbox_probe",
    "git commit -m \"docs: nunca uses git reset --hard ni git clean\"",
    "codex exec \"no corras rm -rf ni git push --force\"",
    "git clean -n",
    "git clean -nd",
    "git commit -q -F - <<'EOF'\nfeat: x\n\nevita docker system prune y rm -rf\nEOF",
    "cat > nota.md <<EOF\nrm -rf apps\nEOF",
    "git status --short",
    "git diff --stat",
    "git log --oneline -5",
    "git restore --staged file.ts",
    "git push origin main",
    "git commit -m 'fix: x'",
    "docker compose --profile services up -d --build",
    "docker compose down",
    "psql -c 'delete from \"Tenant\" where slug = 1'",
    "pnpm -r run test",
    "ls -la && cat package.json | grep rm",
    "GUARD_OK=1 rm -rf apps/foo",
]


class GuardTest(unittest.TestCase):
    def test_blocked(self):
        for cmd in BLOCKED:
            with self.subTest(cmd=cmd):
                self.assertIsNotNone(guard.inspect(cmd))

    def test_allowed(self):
        for cmd in ALLOWED:
            with self.subTest(cmd=cmd):
                self.assertIsNone(guard.inspect(cmd))


if __name__ == "__main__":
    unittest.main()
