import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { extrairBearer, verificarTokenFirebase, type ResolverChave } from "./tokenServidor";

const PROJETO = "normareview-teste";
const AGORA = 1_800_000_000;

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const outroPar = generateKeyPairSync("rsa", { modulusLength: 2048 });

/** Resolver de teste: só conhece a chave "k1". */
const resolver: ResolverChave = async (kid) => (kid === "k1" ? publicKey : null);

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/** Monta um ID token no formato do Firebase, assinado com a chave dada. */
function token(
  corpo: Record<string, unknown> = {},
  cabecalho: Record<string, unknown> = {},
  chave: KeyObject = privateKey,
): string {
  const h = b64({ alg: "RS256", kid: "k1", typ: "JWT", ...cabecalho });
  const p = b64({
    aud: PROJETO,
    iss: `https://securetoken.google.com/${PROJETO}`,
    sub: "uid-123",
    iat: AGORA - 10,
    auth_time: AGORA - 100,
    exp: AGORA + 3000,
    ...corpo,
  });
  const assinatura = sign("RSA-SHA256", Buffer.from(`${h}.${p}`), chave).toString("base64url");
  return `${h}.${p}.${assinatura}`;
}

const verificar = (t: string) => verificarTokenFirebase(t, PROJETO, resolver, AGORA);

describe("firebase/tokenServidor — verificarTokenFirebase", () => {
  test("token válido devolve o uid", async () => {
    expect(await verificar(token())).toEqual({ uid: "uid-123" });
  });

  test("recusa assinatura de outra chave", async () => {
    expect(await verificar(token({}, {}, outroPar.privateKey))).toBeNull();
  });

  test("recusa corpo adulterado depois da assinatura", async () => {
    const [h, , s] = token().split(".");
    const adulterado = b64({
      aud: PROJETO,
      iss: `https://securetoken.google.com/${PROJETO}`,
      sub: "outro-uid",
      iat: AGORA - 10,
      auth_time: AGORA - 100,
      exp: AGORA + 3000,
    });
    expect(await verificar(`${h}.${adulterado}.${s}`)).toBeNull();
  });

  test("recusa outro projeto (aud) e outro emissor (iss)", async () => {
    expect(await verificar(token({ aud: "outro-projeto" }))).toBeNull();
    expect(await verificar(token({ iss: "https://securetoken.google.com/outro-projeto" }))).toBeNull();
  });

  test("recusa token expirado e emitido no futuro", async () => {
    expect(await verificar(token({ exp: AGORA - 3600 }))).toBeNull();
    expect(await verificar(token({ iat: AGORA + 3600 }))).toBeNull();
    expect(await verificar(token({ auth_time: AGORA + 3600 }))).toBeNull();
  });

  test("recusa sub vazio, algoritmo diferente e kid desconhecido", async () => {
    expect(await verificar(token({ sub: "" }))).toBeNull();
    expect(await verificar(token({}, { alg: "HS256" }))).toBeNull();
    expect(await verificar(token({}, { kid: "k-desconhecido" }))).toBeNull();
  });

  test("recusa lixo e projeto não configurado", async () => {
    expect(await verificar("abc")).toBeNull();
    expect(await verificar("a.b.c")).toBeNull();
    expect(await verificarTokenFirebase(token(), "", resolver, AGORA)).toBeNull();
  });
});

describe("firebase/tokenServidor — extrairBearer", () => {
  test("lê o token do cabeçalho Authorization", () => {
    expect(extrairBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(extrairBearer("bearer   xyz")).toBe("xyz");
    expect(extrairBearer(["Bearer t1"])).toBe("t1");
  });

  test("ausente ou fora do formato devolve null", () => {
    expect(extrairBearer(undefined)).toBeNull();
    expect(extrairBearer("")).toBeNull();
    expect(extrairBearer("Basic abc")).toBeNull();
    expect(extrairBearer("Bearer")).toBeNull();
  });
});
