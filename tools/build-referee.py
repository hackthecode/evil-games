# Bundles the referee server modules into one file for a Supabase Edge Function.
# Usage: python3 tools/build-referee.py  →  supabase/functions/referee/index.ts
#
# Every module is wrapped in a function (to avoid name clashes), and the imports
# are replaced with access to the already loaded modules. Supports the project's code style:
# import { a, b as c } from './x.js';  import X from './x.js';  export function/const/default.
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODULES = [
    'js/i18n/tk.js',
    'js/store/hash.js',
    'js/net/rng.js',
    'js/games/cards/suits.js',
    'js/games/cards/cards.js',
    'js/games/belot/engine.js',
    'js/games/belot/referee.js',
    'js/games/santase/engine.js',
    'js/games/santase/referee.js',
    'js/games/blato/engine.js',
    'js/games/blato/referee.js',
    'js/net/referee/core.js',
]
REDUCERS = {'belot': 'js/games/belot/referee.js', 'santase': 'js/games/santase/referee.js', 'blato': 'js/games/blato/referee.js'}


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
    code = re.sub(r"import\s+(\w+)\s+from\s*'([^']+)';", lambda m: f"const {m.group(1)} = __m['{resolve(path, m.group(2))}'].default;", code)
    if re.search(r"^\s*import\s", code, re.M):
        raise SystemExit(f'Unsupported import in {path}')

    code = re.sub(r'^(\s*)export\s+((?:async\s+)?function\s*\*?\s*|const\s+|let\s+|class\s+)(\w+)', lambda m: (names.append(m.group(3)), m.group(1) + m.group(2) + m.group(3))[1], code, flags=re.M)
    has_default = bool(re.search(r'^export\s+default\s', code, re.M))
    code = re.sub(r'^export\s+default\s', 'const __default = ', code, flags=re.M)
    if re.search(r'^\s*export\s', code, re.M):
        raise SystemExit(f'Unsupported export in {path}')
    ret = ', '.join(names + (['default: __default'] if has_default else []))
    return f"__m['{path}'] = (() => {{\n{code}\nreturn {{ {ret} }};\n}})();\n"


def main():
    out = ['// AUTO-GENERATED FILE – do not edit by hand.',
           '// Source: the modules in js/ (see tools/build-referee.py).',
           '// @ts-nocheck', '/* eslint-disable */', 'const __m = {};']
    for p in MODULES:
        out.append(transform(p))
    out.append("export const { createMatch, restoreMatch, forSeat } = __m['js/net/referee/core.js'];")
    out.append('export const REDUCERS = {' + ', '.join(f"{k}: __m['{v}'].default" for k, v in REDUCERS.items()) + '};')
    bundle = '\n'.join(out)
    open(os.path.join(ROOT, 'supabase/functions/referee/bundle.js'), 'w', encoding='utf-8').write(bundle)
    handler = open(os.path.join(ROOT, 'supabase/functions/referee/handler.ts'), encoding='utf-8').read()
    # a single file to paste into the Supabase editor: the bundle + the handler
    single = bundle.replace('export const { createMatch', 'const { createMatch').replace('export const REDUCERS', 'const REDUCERS')
    single += '\n\n' + handler.replace("import { createMatch, restoreMatch, forSeat, REDUCERS } from './bundle.js';\n", '')
    open(os.path.join(ROOT, 'supabase/functions/referee/index.ts'), 'w', encoding='utf-8').write(single)
    print('OK: bundle.js and index.ts', len(single) // 1024, 'KB')


main()
