const sodium = require("libsodium-wrappers");

const API = "https://api.github.com";

async function github(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${process.env.GH_TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        throw new Error(
            `${response.status} ${response.statusText}\n${await response.text()}`
        );
    }

    return response;
}

async function encryptForGitHub(plaintext, publicKey) {
    await sodium.ready;

    return Buffer.from(
        sodium.crypto_box_seal(
            Buffer.from(plaintext),
            Buffer.from(publicKey, "base64")
        )
    ).toString("base64");
}

function getPaths({
    scope,
    org,
    owner,
    repo,
    environment,
    secretName
}) {
    switch (scope) {
        case "organization":
            return {
                publicKey: `/orgs/${org}/actions/secrets/public-key`,
                secret: `/orgs/${org}/actions/secrets/${secretName}`
            };

        case "repository":
            return {
                publicKey: `/repos/${owner}/${repo}/actions/secrets/public-key`,
                secret: `/repos/${owner}/${repo}/actions/secrets/${secretName}`
            };

        case "environment":
            return {
                publicKey:
                    `/repos/${owner}/${repo}/environments/${environment}/secrets/public-key`,
                secret:
                    `/repos/${owner}/${repo}/environments/${environment}/secrets/${secretName}`
            };

        default:
            throw new Error(
                `Unsupported secret scope: ${scope}`
            );
    }
}

async function uploadSecret({
    scope,
    secretName,
    plaintext,
    org,
    owner,
    repo,
    environment,
    visibility = "all"
}) {
    const paths = getPaths({
        scope,
        secretName,
        org,
        owner,
        repo,
        environment
    });

    const { key, key_id } =
        await (await github(paths.publicKey)).json();

    const body = {
        encrypted_value:
            await encryptForGitHub(plaintext, key),
        key_id
    };

    if (scope === "organization") {
        body.visibility = visibility;
    }

    await github(paths.secret, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    return { key, key_id };
}

module.exports = {
    uploadSecret
};
