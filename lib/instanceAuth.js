import crypto from "crypto";

import {
  supabase
} from "./supabase.js";


function sha256(
  value
) {

  return crypto
    .createHash(
      "sha256"
    )
    .update(
      value
    )
    .digest(
      "hex"
    );

}


function getBearerToken(
  request
) {

  const authorization =
    String(
      request.headers.authorization || ""
    ).trim();


  if (
    !authorization
  ) {

    return null;

  }


  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );


  return match
    ? match[1].trim()
    : null;

}


export async function validateInstanceAccess(
  request,
  instanceId
) {

  const token =
    getBearerToken(
      request
    );


  if (
    !token
  ) {

    return {

      ok: false,

      status: 401,

      message:
        "Se requiere acceso a esta instancia."

    };

  }


  const tokenHash =
    sha256(
      token
    );


  const {
    data: session,
    error
  } =
    await supabase

      .from(
        "instance_sessions"
      )

      .select(
        `
        id,
        instance_id,
        expires_at
        `
      )

      .eq(
        "token_hash",
        tokenHash
      )

      .eq(
        "instance_id",
        instanceId
      )

      .maybeSingle();


  if (
    error
  ) {

    throw error;

  }


  if (
    !session
  ) {

    return {

      ok: false,

      status: 401,

      message:
        "La sesión de esta instancia no es válida."

    };

  }


  const expiration =
    new Date(
      session.expires_at
    );


  if (
    expiration.getTime() <=
    Date.now()
  ) {

    return {

      ok: false,

      status: 401,

      message:
        "La sesión de esta instancia ha expirado."

    };

  }


  await supabase

    .from(
      "instance_sessions"
    )

    .update({

      last_used_at:
        new Date()
          .toISOString()

    })

    .eq(
      "id",
      session.id
    );


  return {

    ok: true,

    session

  };

}