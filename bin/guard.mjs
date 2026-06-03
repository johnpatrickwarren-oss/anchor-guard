#!/usr/bin/env node
// @anchor/guard entry point. Thin — delegates to the cli dispatcher.
import { dispatch } from '../src/cli/dispatch.mjs';
dispatch(process.argv.slice(2));
