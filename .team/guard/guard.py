#!/usr/bin/env python3
"""Hook PreToolUse compartido (Claude Code y Codex): bloquea comandos destructivos.

Lee el JSON del hook por stdin. Si el comando es destructivo sale con código 2 y escribe
la razón en stderr, que el agente recibe como respuesta de la herramienta. El agente debe
preguntar al usuario en el chat; solo tras un sí explícito puede repetir el comando con el
prefijo GUARD_OK=1 (ver AGENTS.md).
"""
import json
import os
import re
import shlex
import sys
import time

SAFE_RM_TARGETS = re.compile(
    r"(^|/)(\.next|node_modules|dist|build|coverage|\.turbo|__pycache__|\.sandbox_probe)(/|$)"
    r"|^/private/tmp/|^/tmp/|^/private/var/folders/|^\./\.sandbox_probe$"
)

GIT_BLOCKED = [
    (re.compile(r"\bgit\b.*\breset\b.*--hard"), "git reset --hard descarta trabajo sin commitear"),
    (re.compile(r"\bgit\b.*\bclean\b(?!.*(\s-\w*n\w*\b|--dry-run))"), "git clean borra archivos sin trackear"),
    (re.compile(r"\bgit\b.*\bcheckout\b.*\s--\s"), "git checkout -- descarta cambios del árbol"),
    (re.compile(r"\bgit\b.*\bcheckout\b\s+\.(\s|$)"), "git checkout . descarta cambios del árbol"),
    (re.compile(r"\bgit\b.*\brestore\b(?!.*--staged)"), "git restore descarta cambios del árbol"),
    (re.compile(r"\bgit\b.*\bpush\b.*(--force|--force-with-lease|\s-f(\s|$))"), "force push reescribe el remoto"),
    (re.compile(r"\bgit\b.*\bbranch\b.*\s-D\b"), "git branch -D borra una rama sin merge"),
    (re.compile(r"\bgit\b.*\bstash\b\s+(drop|clear)"), "git stash drop/clear pierde trabajo guardado"),
]

SQL_BLOCKED = [
    (re.compile(r"\b(drop\s+(table|database|schema)|truncate\s+table)\b", re.I), "SQL destructivo (DROP/TRUNCATE)"),
    (re.compile(r"\bdelete\s+from\b(?!.*\bwhere\b)", re.I), "DELETE FROM sin WHERE"),
]

OTHER_BLOCKED = [
    (re.compile(r"\bfind\b.*(\s-delete\b|-exec\s+rm\b)"), "find -delete / -exec rm borra en masa"),
    (re.compile(r"\bxargs\b.*\brm\b"), "xargs rm borra en masa"),
    (re.compile(r"\bdocker\b.*\bcompose\b.*\bdown\b.*(\s-v\b|--volumes)"), "docker compose down -v borra los volúmenes de datos"),
    (re.compile(r"\bdocker\b.*\bvolume\b\s+(rm|prune)"), "docker volume rm/prune borra datos"),
    (re.compile(r"\bdocker\b.*\bsystem\b\s+prune"), "docker system prune borra imágenes y volúmenes"),
    (re.compile(r"\b(shred|mkfs|truncate)\b"), "comando de borrado/sobrescritura de bajo nivel"),
    (re.compile(r"\bdd\b.*\bof="), "dd of= sobrescribe el destino"),
    (re.compile(r"\bprisma\b.*\bmigrate\b\s+reset"), "prisma migrate reset borra la base de datos"),
]

QUOTED = re.compile(r"'[^']*'|\"[^\"]*\"")
SPLIT = re.compile(r"&&|\|\||;|\||\n")


HEREDOC = re.compile(r"(^[^\n]*?)<<-?\s*(['\"]?)(\w+)\2([^\n]*)\n.*?\n[ \t]*\3[ \t]*(?=\n|$)", re.S | re.M)
INTERPRETERS = re.compile(r"\b(sh|bash|zsh|dash|psql|python3?|node|ruby|perl|sqlite3|mysql|docker|ssh)\b")


def strip_heredocs(command):
    """Quita los cuerpos de heredoc que son datos (mensajes de commit, cat > archivo), no código."""

    def drop(match):
        head = match.group(1) + match.group(4)
        return match.group(0) if INTERPRETERS.search(head) else match.group(1) + match.group(4)

    return HEREDOC.sub(drop, command)


def rm_targets(tokens):
    args = [t for t in tokens[1:] if not t.startswith("-")]
    return args


def check_rm(tokens):
    targets = rm_targets(tokens)
    if not targets:
        return None
    unsafe = [t for t in targets if not SAFE_RM_TARGETS.search(t)]
    if unsafe:
        return f"rm sobre {', '.join(unsafe[:3])}: borrar archivos requiere confirmación del usuario"
    return None


def inspect(command):
    if re.search(r"(^|\s)GUARD_OK=1(\s|$)", command):
        return None
    command = strip_heredocs(command)
    for segment in SPLIT.split(command):
        segment = segment.strip()
        if not segment:
            continue
        try:
            tokens = shlex.split(segment)
        except ValueError:
            tokens = segment.split()
        while tokens and (re.match(r"^\w+=", tokens[0]) or tokens[0] in ("sudo", "command", "env", "nohup", "time")):
            tokens = tokens[1:]
        if tokens and os.path.basename(tokens[0]) in ("rm", "rmdir", "unlink"):
            reason = check_rm(tokens)
            if reason:
                return reason
    unquoted = QUOTED.sub("''", command)
    for pattern, reason in GIT_BLOCKED + OTHER_BLOCKED:
        if pattern.search(unquoted):
            return reason
    for pattern, reason in SQL_BLOCKED:
        if pattern.search(command):
            return reason
    return None


def main():
    try:
        event = json.load(sys.stdin)
    except Exception:
        return 0
    tool_input = event.get("tool_input") or {}
    command = tool_input.get("command") or tool_input.get("cmd") or ""
    if isinstance(command, list):
        command = " ".join(command)
    if not isinstance(command, str) or not command:
        return 0
    reason = inspect(command)
    if not reason:
        return 0
    try:
        log = os.path.join(os.path.dirname(os.path.abspath(__file__)), "blocked.log")
        with open(log, "a", encoding="utf-8") as fh:
            fh.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')}\t{reason}\t{command[:300]}\n")
    except OSError:
        pass
    sys.stderr.write(
        f"BLOQUEADO por el guard del equipo: {reason}.\n"
        "No lo ejecutes. Pregunta al usuario en el chat y espera su sí explícito. "
        "Solo después puedes repetir el comando con el prefijo GUARD_OK=1.\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
