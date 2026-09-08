import {
  createClient
} from "@supabase/supabase-js";


export default async function handler(
  request,
  response
) {

  const supabaseUrl =
    process.env.SUPABASE_URL || "";


  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY || "";


  let projectHost =
    "NO_CONFIGURADO";


  try {

    projectHost =
      new URL(
        supabaseUrl
      ).hostname;

  } catch {

    projectHost =
      "URL_INVALIDA";

  }


  let keyType =
    "desconocida";


  if (
    supabaseKey.startsWith(
      "sb_secret_"
    )
  ) {

    keyType =
      "sb_secret";

  } else if (
    supabaseKey.startsWith(
      "sb_publishable_"
    )
  ) {

    keyType =
      "sb_publishable";

  } else if (
    supabaseKey.startsWith(
      "eyJ"
    )
  ) {

    keyType =
      "legacy_jwt";

  }


  try {

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );


    const {
      data,
      error
    } =
      await supabase
        .from(
          "instances"
        )
        .select(
          "id,name,enabled,visibility,current_version"
        );


    return response
      .status(200)
      .json({

        ok:
          !error,

        projectHost,

        keyType,

        env: {

          hasUrl:
            Boolean(
              supabaseUrl
            ),

          hasSecretKey:
            Boolean(
              supabaseKey
            )

        },

        database: {

          error:
            error
              ? {
                  message:
                    error.message,

                  code:
                    error.code
                }
              : null,

          rowCount:
            Array.isArray(data)
              ? data.length
              : null,

          rows:
            data || []

        }

      });


  } catch (error) {

    return response
      .status(500)
      .json({

        ok: false,

        projectHost,

        keyType,

        message:
          error.message

      });

  }

}