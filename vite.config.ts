import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const adoTestApiPlugin = (): Plugin => ({
  name: 'ado-test-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url && req.url.includes('/.netlify/functions/')) {
        try {
          console.log(`\n--- [DIAGNOSTIC PROXY] Intercepting ${req.url} ---`);
          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const pathname = urlObj.pathname.replace(/\/$/, '');
          const functionName = pathname.split('/').pop();

          if (!functionName) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: { message: 'Invalid function URL' } }));
          }

          let bodyStr = '';
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            if ((req as any).body) {
              bodyStr = typeof (req as any).body === 'string' ? (req as any).body : JSON.stringify((req as any).body);
            } else if (req.complete || req.readableEnded) {
              bodyStr = '';
            } else {
              // Use a timeout to prevent the proxy from hanging indefinitely if the stream is dead
              bodyStr = await new Promise<string>((resolve, reject) => {
                let body = '';
                const timeout = setTimeout(() => resolve(body), 5000);
                const onData = (chunk: any) => { body += chunk.toString(); };
                const onEnd = () => { cleanup(); resolve(body); };
                const onError = (err: any) => { cleanup(); reject(err); };
                const cleanup = () => {
                  clearTimeout(timeout);
                  req.removeListener('data', onData);
                  req.removeListener('end', onEnd);
                  req.removeListener('error', onError);
                };
                req.on('data', onData);
                req.on('end', onEnd);
                req.on('error', onError);
              });
            }
          }

          const modulePath = path.join(process.cwd(), 'netlify', 'functions', `${functionName}.ts`);

          if (!fs.existsSync(modulePath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: { message: `Function file not found locally: ${functionName}.ts` } }));
          }

          const module = await server.ssrLoadModule(modulePath);

          const event = {
            httpMethod: req.method,
            body: bodyStr,
            headers: req.headers,
            queryStringParameters: Object.fromEntries(urlObj.searchParams)
          };

          const result = await module.handler(event, {} as any);
          console.log(`[DIAGNOSTIC PROXY] Handler completed with status:`, result?.statusCode);

          res.statusCode = result.statusCode || 200;
          if (result.headers) {
            for (const [k, v] of Object.entries(result.headers)) {
              res.setHeader(k, v as string);
            }
          }
          if (!res.hasHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json');
          }
          
          return res.end(result.body || '');
        } catch (err: any) {
          console.error(`\n--- [DIAGNOSTIC PROXY] CRASH CAUGHT ---`);
          console.error(err.stack);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: { message: `Local dev server proxy crash: ${err.message}`, stack: err.stack } }));
          }
          return res.end();
        }
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [react({ babel: { plugins: [
function __dualiteSourceLoc({ types: t }) {
  return { visitor: { JSXOpeningElement(path, state) {
    var fn = state.filename || '';
    if (!fn || fn.includes('node_modules')) return;
    var name = path.node.name;
    var reactSpecials = ['Fragment', 'StrictMode', 'Suspense', 'Profiler'];
    var isReactSpecial = (name.type === 'JSXIdentifier' && reactSpecials.indexOf(name.name) !== -1) ||
      (name.type === 'JSXMemberExpression' && name.object && name.object.name === 'React' && name.property && reactSpecials.indexOf(name.property.name) !== -1) ||
      (name.type === 'JSXMemberExpression' && name.property && (name.property.name === 'Provider' || name.property.name === 'Consumer'));
    if (isReactSpecial) return;
    var attrs = path.node.attributes;
    for (var i = 0; i < attrs.length; i++) {
      if (attrs[i].type === 'JSXAttribute' && attrs[i].name && attrs[i].name.name === 'data-ds') return;
    }
    var loc = path.node.loc;
    if (!loc) return;
    var wd = '/home/project/';
    var rel = fn.startsWith(wd) ? fn.slice(wd.length) : fn;
    attrs.push(t.jsxAttribute(t.jsxIdentifier('data-ds'), t.stringLiteral(rel + ':' + loc.start.line + ':' + loc.start.column)));
  } } };
}
] } }), adoTestApiPlugin()],
  optimizeDeps: { exclude: ['lucide-react'] },
});
