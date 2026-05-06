import { register } from 'node:module'

register(new URL('./dot-dev-alias-loader.mjs', import.meta.url))
