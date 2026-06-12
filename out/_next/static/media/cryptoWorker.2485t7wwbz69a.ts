// Crypto worker – RSA key generation with full format support via node-forge + sshpk fallback

import * as Comlink from "comlink";
import forge from "node-forge";
import sshpk from "sshpk";

// -------------------------------------------------------------------
// Helper: Generate RSA key pair using Web Crypto (preferred & fastest)
// -------------------------------------------------------------------
async function generateWithWebCrypto(modulusLength: 2048 | 4096 = 2048) {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto not available");
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.publicKey),
    crypto.subtle.exportKey("jwk", keyPair.privateKey),
  ]);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicJwk,
    privateJwk,
  };
}

// -------------------------------------------------------------------
// Main API – only generateRsaKeyPair is exposed now
// -------------------------------------------------------------------
export interface CryptoWorkerApi {
  generateRsaKeyPair: (options?: {
    bits?: number;
    format?: sshpk.PrivateKeyFormatType;
    password?: string;
    comment?: string;
  }) => Promise<{
    publicKey: string;
    privateKey: string;
  }>;
}

const api: CryptoWorkerApi = {
  async generateRsaKeyPair(options = {}) {
    const modulusLength = options.bits ?? 2048;
    const format = options.format ?? "jwk";
    const comment = options.comment ?? "";
    const password = options.password || undefined;

    //console.log(options);

    const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair({
      bits: modulusLength
    });

    const privateUnencryptedKeyPem = forge.pki.privateKeyToPem(privateKey);

    if (format === "pem") {
      return {
        publicKey: forge.pki.publicKeyToPem(publicKey),
        privateKey: password
          ? forge.pki.encryptRsaPrivateKey(privateKey, password)
          : privateUnencryptedKeyPem,
      };
    }

    const privKey = sshpk.parsePrivateKey(privateUnencryptedKeyPem);
    privKey.comment = comment;
    const pubFormat = format ?? "ssh";
    let privFormat = format ?? "ssh";
    if (privFormat === "ssh") {
      privFormat = "ssh-private";
    }
    const pubKey = privKey.toPublic();
    return {
      publicKey: pubKey.toString(pubFormat),
      privateKey: password
        ? privKey.toString(privFormat, {
            passphrase: password,
            comment: comment,
          })
        : privKey.toString(privFormat, { comment: comment }),
    };
  },
};

// Expose via Comlink
Comlink.expose(api);
