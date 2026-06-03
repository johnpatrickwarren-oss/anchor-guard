#!/usr/bin/env node
// @anchor/guard entry point. Thin — delegates to the cli dispatcher.
import { dispatch } from '../src/cli/dispatch.mjs';
Promise.resolve(dispatch(process.argv.slice(2))).catch((e) => { console.error(e); process.exit(1); });
