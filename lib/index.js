const {
    uploadSecret
} = require("./github");

const {
    bootstrapSops
} = require("./bootstrap-sops");

module.exports = {
    uploadSecret,
    bootstrapSops
};
