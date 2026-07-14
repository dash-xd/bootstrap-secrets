const fs = require("fs");

const {
    uploadSecret
} = require("./github");

function getConfig() {
    return {
        secretScope:
            process.env.SECRET_SCOPE ??
            "repository",

        secretName:
            process.env.SECRET_NAME ??
            "SOPS_AGE_KEY",

        ageKeyFile:
            process.env.AGE_KEY_FILE ??
            "/tmp/age/keys.txt",

        org: process.env.ORG,
        owner: process.env.OWNER,
        repo: process.env.REPO,
        environment: process.env.ENVIRONMENT
    };
}

function loadAgeIdentity(path) {
    if (!fs.existsSync(path)) {
        throw new Error(`${path} does not exist`);
    }

    const ageKey =
        fs.readFileSync(path, "utf8");

    if (!ageKey.includes("AGE-SECRET-KEY")) {
        throw new Error(
            "Invalid age identity file"
        );
    }

    return ageKey;
}

async function uploadAgeIdentity(config, ageKey) {
    console.log(
        `Uploading ${config.secretName} (${config.secretScope})...`
    );

    return uploadSecret({
        scope: config.secretScope,
        secretName: config.secretName,
        plaintext: ageKey,
        org: config.org,
        owner: config.owner,
        repo: config.repo,
        environment: config.environment
    });
}

function writeSopsConfig(ageKey) {
    const recipient =
        ageKey
            .split("\n")
            .find(line =>
                line.includes("public key")
            );

    fs.writeFileSync(
        ".sops.yaml",
        `creation_rules:
  - path_regex: .*
    age: ${recipient}`
    );

    return recipient;
}

function printSummary(recipient, githubKey) {
    console.log("Created .sops.yaml");
    console.log();
    console.log("BOOTSTRAP COMPLETE");
    console.log();

    if (recipient) {
        console.log(recipient);
        console.log();
    }

    console.log(
        `GitHub key id: ${githubKey.key_id}`
    );
}

async function bootstrapSops() {
    const config = getConfig();

    const ageKey =
        loadAgeIdentity(config.ageKeyFile);

    const githubKey =
        await uploadAgeIdentity(
            config,
            ageKey
        );

    const recipient =
        writeSopsConfig(ageKey);

    printSummary(
        recipient,
        githubKey
    );
}

module.exports = {
    bootstrapSops
};
