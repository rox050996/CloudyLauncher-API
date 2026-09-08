import crypto from "crypto";

import {
  supabase
} from "../../lib/supabase.js";


const SESSION_DAYS = 30;


/* =========================================================
   SHA-256
========================================================= */

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


/* =========================================================
   ENDPOINT
========================================================= */

export default async function handler(
  request,
  response
) {

  if (
    request.method !==
    "POST"
  ) {

    return response
      .status(405)
      .json({

        ok: false,

        message:
          "Method not allowed."

      });

  }


  try {

    /* =====================================================
       VALIDAR CÓDIGO
    ===================================================== */

    const code =
      String(
        request.body?.code || ""
      )
        .trim()
        .toUpperCase();


    if (
      !code
    ) {

      return response
        .status(400)
        .json({

          ok: false,

          message:
            "Escribe un código."

        });

    }


    if (
      code.length > 100
    ) {

      return response
        .status(400)
        .json({

          ok: false,

          message:
            "Código inválido."

        });

    }


    /*
     * El código real nunca se busca directamente.
     * Convertimos lo recibido a SHA-256.
     */

    const codeHash =
      sha256(
        code
      );


    const {
      data: accessCode,
      error: codeError
    } =
      await supabase

        .from(
          "instance_codes"
        )

        .select(
          `
          id,
          instance_id,
          enabled,
          max_uses,
          uses,
          expires_at
          `
        )

        .eq(
          "code_hash",
          codeHash
        )

        .maybeSingle();


    if (
      codeError
    ) {

      throw codeError;

    }


    if (
      !accessCode ||
      !accessCode.enabled
    ) {

      return response
        .status(401)
        .json({

          ok: false,

          message:
            "El código no es válido."

        });

    }


    /* =====================================================
       EXPIRACIÓN DEL CÓDIGO
    ===================================================== */

    if (
      accessCode.expires_at
    ) {

      const expiresAt =
        new Date(
          accessCode.expires_at
        );


      if (
        expiresAt.getTime() <=
        Date.now()
      ) {

        return response
          .status(401)
          .json({

            ok: false,

            message:
              "Este código ha expirado."

          });

      }

    }


    /* =====================================================
       LÍMITE DE USOS
    ===================================================== */

    if (
      accessCode.max_uses !== null &&
      accessCode.uses >=
        accessCode.max_uses
    ) {

      return response
        .status(401)
        .json({

          ok: false,

          message:
            "Este código ya alcanzó su límite de usos."

        });

    }


    /* =====================================================
       COMPROBAR INSTANCIA
    ===================================================== */

    const {
      data: instance,
      error: instanceError
    } =
      await supabase

        .from(
          "instances"
        )

        .select(
          `
          id,
          name,
          description,
          minecraft_version,
          loader,
          loader_version,
          current_version,
          visibility
          `
        )

        .eq(
          "id",
          accessCode.instance_id
        )

        .eq(
          "enabled",
          true
        )

        .maybeSingle();


    if (
      instanceError
    ) {

      throw instanceError;

    }


    if (
      !instance
    ) {

      return response
        .status(404)
        .json({

          ok: false,

          message:
            "La instancia asociada ya no está disponible."

        });

    }


    /* =====================================================
       CREAR TOKEN DE SESIÓN
    ===================================================== */

    const rawToken =
      crypto
        .randomBytes(
          32
        )
        .toString(
          "hex"
        );


    /*
     * Supabase tampoco guardará el token real.
     * Solo guardamos su SHA-256.
     */

    const tokenHash =
      sha256(
        rawToken
      );


    const expiresAt =
      new Date(
        Date.now() +
        SESSION_DAYS *
        24 *
        60 *
        60 *
        1000
      );


    const {
      error: sessionError
    } =
      await supabase

        .from(
          "instance_sessions"
        )

        .insert({

          instance_id:
            instance.id,

          token_hash:
            tokenHash,

          expires_at:
            expiresAt.toISOString()

        });


    if (
      sessionError
    ) {

      throw sessionError;

    }


    /* =====================================================
       CONTABILIZAR USO DEL CÓDIGO
    ===================================================== */

    const {
      error: updateError
    } =
      await supabase

        .from(
          "instance_codes"
        )

        .update({

          uses:
            accessCode.uses + 1

        })

        .eq(
          "id",
          accessCode.id
        );


    if (
      updateError
    ) {

      throw updateError;

    }


    /* =====================================================
       RESPUESTA
    ===================================================== */

    return response
      .status(200)
      .json({

        ok: true,

        message:
          `${instance.name} fue agregada correctamente.`,

        accessToken:
          rawToken,

        expiresAt:
          expiresAt.toISOString(),

        instance: {

          id:
            instance.id,

          name:
            instance.name,

          description:
            instance.description,

          minecraftVersion:
            instance.minecraft_version,

          loader:
            instance.loader,

          loaderVersion:
            instance.loader_version,

          currentVersion:
            instance.current_version,

          visibility:
            instance.visibility

        }

      });


  } catch (error) {

    console.error(
      "redeem code error:",
      error
    );


    return response
      .status(500)
      .json({

        ok: false,

        message:
          "No se pudo validar el código."

      });

  }

}