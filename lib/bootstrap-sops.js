const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { uploadSecret } = require("./github");

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

        maraiDir:
            process.env.MARAI_DIR ??
            process.cwd(),

        org: process.env.ORG,
        owner: process.env.OWNER,
        repo: process.env.REPO,
        environment: process.env.ENVIRONMENT,

        existingAgeKey:
            process.env.SOPS_AGE_KEY
    };
}

function ensureAgeDirectory(ageKeyFile) {
    fs.mkdirSync(
        path.dirname(ageKeyFile),
        { recursive: true }
    );
}

function restoreAgeIdentity(config) {
    console.log("Restoring existing SOPS age identity");

    fs.writeFileSync(
        config.ageKeyFile,
        `${config.existingAgeKey}\n`,
        { mode: 0o600 }
    );
}

function generateAgeIdentity(config) {
    console.log("Generating new SOPS age identity");

    execFileSync(
        "age-keygen",
        [
            "-o",
            config.ageKeyFile
        ],
        {
            stdio: "inherit"
        }
    );

    fs.chmodSync(
        config.ageKeyFile,
        0o600
    );
}

function loadAgeIdentity(ageKeyFile) {
    if (!fs.existsSync(ageKeyFile)) {
        throw new Error(
            `${ageKeyFile} does not exist`
        );
    }

    const ageKey =
        fs.readFileSync(
            ageKeyFile,
            "utf8"
        );

    if (!ageKey.includes("AGE-SECRET-KEY")) {
        throw new Error(
            "Invalid age identity"
        );
    }

    return ageKey;
}

async function uploadAgeIdentity(config, ageKey) {
    console.log(
        `Uploading ${config.secretName} (${config.secretScope})`
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

function extractRecipient(ageKey) {
    const recipient =
        ageKey
            .split("\n")
            .find(line =>
                line.startsWith("# public key:")
            )
            ?.replace(
                "# public key:",
                ""
            )
            .trim();

    if (!recipient) {
        throw new Error(
            "Unable to determine age recipient"
        );
    }

    return recipient;
}

function writeSopsConfig(config, recipient) {
    const sopsFile =
        path.join(
            config.maraiDir,
            ".sops.yaml"
        );

    fs.writeFileSync(
        sopsFile,
`creation_rules:
  - path_regex: .*
    age: ${recipient}
`
    );

    console.log(
        `Created ${sopsFile}`
    );
}

async function ensureAgeIdentity(config) {
    ensureAgeDirectory(
        config.ageKeyFile
    );

    if (config.existingAgeKey) {
        restoreAgeIdentity(config);
    } else {
        generateAgeIdentity(config);
    }

    const ageKey =
        loadAgeIdentity(
            config.ageKeyFile
        );

    if (!config.existingAgeKey) {
        await uploadAgeIdentity(
            config,
            ageKey
        );
    }

    return ageKey;
}

function printSummary(recipient) {
    console.log();
    console.log("BOOTSTRAP COMPLETE");
    console.log();
    console.log(
        `Recipient: ${recipient}`
    );
}

async function bootstrapSops() {
    const config =
        getConfig();

    const ageKey =
        await ensureAgeIdentity(
            config
        );

    const recipient =
        extractRecipient(ageKey);

    writeSopsConfig(
        config,
        recipient
    );

    printSummary(
        recipient
    );
}

if (require.main === module) {
    bootstrapSops().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = {
    bootstrapSops
};
