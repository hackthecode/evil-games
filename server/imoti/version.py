"""Версии на играта — запазване и връщане назад.

Всяка версия е снимка на кода в даден момент. Данните на играта (базата
със запазените партии) НЕ влизат в снимките: при връщане към стара версия
партиите ви остават непокътнати.

Използване:
    python version.py                     показва всички версии
    python version.py запази "описание"   запазва текущото състояние
    python version.py върни 3             връща състоянието на версия 3
    python version.py разлика 3           показва какво се е променило оттогава

Връщането НИКОГА не изтрива работа: преди него текущото състояние се
запазва автоматично като нова версия, така че всяко връщане може да се
върне обратно.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Windows конзолата често е cp1252 — иначе българският текст се чупи.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass


class VersionError(Exception):
    """Съобщение, предназначено за потребителя."""


def _git(*args: str, check: bool = True) -> str:
    """Изпълнява git в папката на играта и връща изхода."""
    result = subprocess.run(
        ["git", "-C", str(BASE_DIR), *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if check and result.returncode != 0:
        raise VersionError((result.stderr or result.stdout).strip())
    return (result.stdout or "").strip()


def _ensure_repo() -> None:
    # Само собствено хранилище: вградено като подпапка в друго (например в
    # портала evil-games), git би намерил родителското и записал в него.
    try:
        toplevel = Path(_git("rev-parse", "--show-toplevel")).resolve()
    except (VersionError, FileNotFoundError):
        toplevel = None
    if toplevel != BASE_DIR.resolve():
        raise VersionError(
            "Историята на версиите не е създадена в тази папка.\n"
            "Ако сте местили проекта, изпълнете отново настройката."
        )


def _versions() -> list[dict[str, str]]:
    """Всички версии, най-новата първа."""
    raw = _git("log", "--pretty=format:%h\x1f%ad\x1f%s", "--date=format:%d.%m.%Y %H:%M")
    if not raw:
        return []
    out = []
    for line in raw.splitlines():
        short, date, subject = line.split("\x1f", 2)
        out.append({"hash": short, "date": date, "subject": subject})
    return out


def _has_changes() -> bool:
    return bool(_git("status", "--porcelain"))


def _changed_count(ref: str) -> int:
    raw = _git("diff", "--name-only", f"{ref}..HEAD", check=False)
    return len([line for line in raw.splitlines() if line.strip()])


# ----------------------------------------------------------------------
# Команди
# ----------------------------------------------------------------------
def save(description: str = "", *, quiet: bool = False) -> bool:
    """Запазва текущото състояние като нова версия. Връща дали е записано."""
    _ensure_repo()
    if not _has_changes():
        if not quiet:
            print("Няма промени за запазване — последната версия е актуална.")
        return False
    _git("add", "-A")
    text = description.strip() or "Ръчно запазване"
    # Подписването се изключва изрично: при настроен ключ, който липсва на
    # тази машина, записът иначе се проваля.
    _git("-c", "commit.gpgsign=false", "commit", "-m", text)
    if not quiet:
        version = _versions()[0]
        print(f"Запазено като версия {len(_versions())}: {text}")
        print(f"  {version['date']}")
    return True


def show_list() -> None:
    """Показва всички версии, най-новата отгоре."""
    _ensure_repo()
    versions = _versions()
    if not versions:
        print("Още няма запазени версии.")
        return
    total = len(versions)
    print()
    print(f"  Версии на играта ({total} на брой, най-новата отгоре)")
    print("  " + "─" * 62)
    for index, version in enumerate(versions):
        number = total - index          # 1 е най-старата
        marker = "→" if index == 0 else " "
        print(f"  {marker} {number:>3}.  {version['date']}   {version['subject']}")
    print("  " + "─" * 62)
    if _has_changes():
        print("  Има незапазени промени в момента.")
        print('  Запазете ги с:  python version.py запази "какво променихте"')
    print()
    print("  Връщане назад:  python version.py върни <номер>")
    print()


def _resolve(number: str) -> tuple[str, dict[str, str]]:
    """Превръща номер на версия в git ориентир."""
    versions = _versions()
    total = len(versions)
    try:
        wanted = int(number)
    except ValueError:
        raise VersionError(f"„{number}“ не е номер на версия.")
    if not 1 <= wanted <= total:
        raise VersionError(
            f"Няма версия {wanted}. Има версии от 1 до {total}.\n"
            "Вижте ги с:  python version.py"
        )
    version = versions[total - wanted]
    return version["hash"], version


def restore(number: str) -> None:
    """Връща кода към избрана версия, без да губи текущото състояние."""
    _ensure_repo()
    ref, version = _resolve(number)

    # Първо пазим сегашното — така връщането само може да се върне обратно.
    saved = save(
        f"Автоматично: състоянието преди връщане към версия {number}",
        quiet=True,
    )
    if saved:
        print("Текущото състояние е запазено като нова версия.")

    # Файловете се връщат, но историята остава — нищо не се изтрива.
    _git("checkout", ref, "--", ".")
    _git("-c", "commit.gpgsign=false", "commit", "-m",
         f"Върнато към версия {number}: {version['subject']}", check=False)

    print()
    print(f"Готово. Кодът е върнат към версия {number}:")
    print(f"  {version['date']}   {version['subject']}")
    print()
    print("Запазените партии НЕ са пипани — базата не влиза във версиите.")
    print("Ако сте се върнали по погрешка, изберете последната версия със:")
    print("  python version.py")
    print()


def diff(number: str) -> None:
    """Показва какво се е променило от избраната версия насам."""
    _ensure_repo()
    ref, version = _resolve(number)
    names = _git("diff", "--name-status", f"{ref}..HEAD", check=False)
    print()
    print(f"  Промени след версия {number} ({version['date']}):")
    print("  " + "─" * 62)
    if not names:
        print("  Няма разлика — това е текущото състояние.")
    else:
        labels = {"A": "добавен", "M": "променен", "D": "изтрит", "R": "преименуван"}
        for line in names.splitlines():
            parts = line.split("\t")
            status = labels.get(parts[0][0], parts[0])
            print(f"    {status:<12} {parts[-1]}")
    print()


COMMANDS = {
    "запази": save, "save": save,
    "списък": show_list, "list": show_list,
    "върни": restore, "restore": restore,
    "разлика": diff, "diff": diff,
}


def main() -> None:
    args = sys.argv[1:]
    if not args:
        show_list()
        return
    command = COMMANDS.get(args[0].lower())
    if command is None:
        print(f"Непозната команда „{args[0]}“.")
        print(__doc__)
        sys.exit(1)
    try:
        command(*args[1:])
    except VersionError as exc:
        print(f"\n{exc}\n")
        sys.exit(1)
    except TypeError:
        print(f"Грешен брой аргументи за „{args[0]}“.")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
