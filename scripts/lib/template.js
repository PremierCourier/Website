// Minimal template engine.
//   {{ path }}            escaped value (throws if missing)
//   {{{ path }}}          raw value (throws if missing)
//   {{> name }}           partial, current scope
//   {{> name path }}      partial, scope = value at path
//   {{#if path}} … {{else}} … {{/if}}
//   {{#unless path}} … {{/unless}}
//   {{#each path}} … {{/each}}   item is `this`; its fields resolve directly; @index, @first, @last

const TOKEN = /\{\{\{\s*([^}]+?)\s*\}\}\}|\{\{\s*([#/>]?)\s*([^}]*?)\s*\}\}/g;

export function escapeHtml(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parse(src, name) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    const top = stack[stack.length - 1];
    if (m.index > last) top.children.push({ type: 'text', value: src.slice(last, m.index) });
    last = TOKEN.lastIndex;
    if (m[1] !== undefined) {
      top.children.push({ type: 'raw', path: m[1] });
      continue;
    }
    const sigil = m[2];
    const body = m[3];
    if (sigil === '#') {
      const [kind, path] = body.split(/\s+/, 2);
      if (!['if', 'unless', 'each'].includes(kind)) throw new Error(`${name}: unknown block {{#${kind}}}`);
      const node = { type: kind, path, children: [], alt: null };
      top.children.push(node);
      stack.push(node);
    } else if (sigil === '/') {
      const node = stack.pop();
      if (!node || node.type !== body) throw new Error(`${name}: unexpected {{/${body}}}`);
    } else if (sigil === '>') {
      const [partial, path] = body.split(/\s+/, 2);
      top.children.push({ type: 'partial', name: partial, path });
    } else if (body === 'else') {
      if (top.type !== 'if' && top.type !== 'unless') throw new Error(`${name}: {{else}} outside if`);
      // Nodes after {{else}} collect into `alt`; the stand-in closes on {{/if}}.
      top.alt = [];
      stack[stack.length - 1] = { type: top.type, children: top.alt };
    } else {
      top.children.push({ type: 'var', path: body });
    }
  }
  if (last < src.length) stack[stack.length - 1].children.push({ type: 'text', value: src.slice(last) });
  if (stack.length !== 1) throw new Error(`${name}: unclosed {{#${stack[stack.length - 1].type}}}`);
  return root;
}

function lookup(scopes, path) {
  if (path === 'this') {
    const top = scopes[scopes.length - 1];
    return { found: true, value: top && Object.hasOwn(top, 'this') ? top.this : top };
  }
  const parts = path.split('.');
  const head = parts[0] === 'this' ? parts.slice(1) : parts;
  const searchAll = parts[0] !== 'this';
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (scope != null && typeof scope === 'object' && head[0] in scope) {
      let v = scope;
      for (const p of head) {
        if (v == null) return { found: false };
        v = v[p];
      }
      return { found: v !== undefined, value: v };
    }
    if (!searchAll) break;
  }
  return { found: false };
}

function truthy(v) {
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

export function createRenderer(partials = {}) {
  const cache = new Map();
  const compiled = (src, name) => {
    if (!cache.has(name + '\0' + src)) cache.set(name + '\0' + src, parse(src, name));
    return cache.get(name + '\0' + src);
  };

  function run(nodes, scopes, name) {
    let out = '';
    for (const n of nodes) {
      switch (n.type) {
        case 'text':
          out += n.value;
          break;
        case 'var':
        case 'raw': {
          const r = lookup(scopes, n.path);
          if (!r.found || r.value === null) throw new Error(`${name}: missing value for {{${n.path}}}`);
          out += n.type === 'var' ? escapeHtml(r.value) : String(r.value);
          break;
        }
        case 'if':
        case 'unless': {
          const v = truthy(lookup(scopes, n.path).value);
          const pass = n.type === 'if' ? v : !v;
          out += run(pass ? n.children : n.alt || [], scopes, name);
          break;
        }
        case 'each': {
          const r = lookup(scopes, n.path);
          if (!r.found || !Array.isArray(r.value)) throw new Error(`${name}: {{#each ${n.path}}} is not an array`);
          r.value.forEach((item, i, arr) => {
            const meta = { '@index': i, '@first': i === 0, '@last': i === arr.length - 1 };
            const itemScope = item !== null && typeof item === 'object' ? item : { this: item };
            out += run(n.children, [...scopes, meta, itemScope], name);
          });
          break;
        }
        case 'partial': {
          const src = partials[n.name];
          if (src === undefined) throw new Error(`${name}: unknown partial ${n.name}`);
          let next = scopes;
          if (n.path) {
            const r = lookup(scopes, n.path);
            if (!r.found) throw new Error(`${name}: missing value for partial ${n.name} ${n.path}`);
            next = [...scopes, r.value];
          }
          out += run(compiled(src, n.name).children, next, n.name);
          break;
        }
      }
    }
    return out;
  }

  return function render(src, ctx, name = 'template') {
    return run(compiled(src, name).children, [ctx], name);
  };
}
