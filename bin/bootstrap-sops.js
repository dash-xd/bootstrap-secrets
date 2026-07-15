#!/usr/bin/env node

const {
    bootstrapSops
} = require("../lib/bootstrap-sops");

bootstrapSops()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
