# Събира модулите на Evil Empires в един файл за Supabase Edge Function.
# Употреба: python3 tools/build-empires.py  →  supabase/functions/empires/index.ts
# (същият подход като tools/build-referee.py: всеки модул се обвива във функция)
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODULES = [
    'js/games/empires/data.js',
    'js/games/empires/battle.js',
    'js/games/empires/worldgen.js',
    'js/games/empires/tactics.js',
    'js/games/empires/engine.js',
    'js/games/empires/worldcore.js',
    'js/games/empires/server.js',
]


def resolve(base, rel):
    return os.path.normpath(os.path.join(os.path.dirname(base), rel)).replace(os.sep, '/')


def transform(path):
    code = open(os.path.join(ROOT, path), encoding='utf-8').read()
    names = []

    def named(m):
        parts = [p.strip() for p in m.group(1).split(',') if p.strip()]
        spec = ', '.join(p.replace(' as ', ': ') for p in parts)
        return f"const {{ {spec} }} = __m['{resolve(path, m.group(2))}'];"

    code = re.sub(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)';", named, code)
    code = re.sub(r"import\s*\*\s*as\s+(\w+)\s+from\s*'([^']+)';", lambda m: f"const {m.group(1)} = __m['{resolve(path, m.group(2))}'];", code)
    if re.search(r"^\s*import\s", code, re.M):
        raise SystemExit(f'Неподдържан импорт в {path}')
    code = re.sub(r'^(\s*)export\s+((?:async\s+)?function\s*\*?\s*|const\s+|let\s+|class\s+)(\w+)', lambda m: (names.append(m.group(3)), m.group(1) + m.group(2) + m.group(3))[1], code, flags=re.M)
    if re.search(r'^\s*export\s', code, re.M):
        raise SystemExit(f'Неподдържан export в {path}')
    return f"__m['{path}'] = (() => {{\n{code}\nreturn {{ {', '.join(names)} }};\n}})();\n"


def main():
    out = ['// АВТОМАТИЧНО ГЕНЕРИРАН ФАЙЛ – не редактирайте ръчно.',
           '// Източник: js/games/empires/ и supabase/functions/empires/handler.ts (виж tools/build-empires.py).',
           '// @ts-nocheck', '/* eslint-disable */']
    handler = open(os.path.join(ROOT, 'supabase/functions/empires/handler.ts'), encoding='utf-8').read()
    # импортите на обработчика остават най-отгоре
    imports = [l for l in handler.splitlines() if l.startswith('import ')]
    rest = '\n'.join(l for l in handler.splitlines() if not l.startswith('import '))
    out += imports + ['const __m = {};']
    for p in MODULES:
        out.append(transform(p))
    out.append("const { handle, cron } = __m['js/games/empires/server.js'];")
    out.append(rest)
    single = '\n'.join(out)
    open(os.path.join(ROOT, 'supabase/functions/empires/index.ts'), 'w', encoding='utf-8').write(single)
    print('OK: supabase/functions/empires/index.ts', len(single) // 1024, 'KB')


main()
