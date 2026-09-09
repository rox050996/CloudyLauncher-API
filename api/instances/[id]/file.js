import {
  supabase
} from "../../../lib/supabase.js";

import {
  validateInstanceAccess
} from "../../../lib/instanceAuth.js";


const BUCKET =
  "launcher-files";


const SIGNED_URL_SECONDS =
  60;


/* =========================================================
   ENDPOINT
========================================================= */

export default async function handler(
  request,
  response
) {

  response.setHeader(
    "Cache-Control",
    "no-store"
  );


  if (
    request.method !==
    "GET"
  ) {

    return response
      .status(405)
      .json({

        ok: false,

        message:
          "Method not allowed."

      });

  }


  const {
    id
  } =
    request.query;


  const requestedPath =
    String(
      request.query?.path || ""
    )
      .replaceAll("\\", "/")
      .trim();


  if (
    !id ||
    typeof id !== "string"
  ) {

    return response
      .status(400)
      .json({

        ok: false,

        message:
          "Instance ID is required."

      });

  }


  if (
    !requestedPath
  ) {

    return response
      .status(400)
      .json({

        ok: false,

        message:
          "File path is required."

      });

  }


  try {

    /* =====================================================
       INSTANCIA
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
          current_version,
          visibility
          `
        )

        .eq(
          "id",
          id
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
            "Instance not found."

        });

    }


    /* =====================================================
       VALIDAR ACCESO
    ===================================================== */

    if (
      instance.visibility ===
      "private"
    ) {

      const access =
        await validateInstanceAccess(
          request,
          instance.id
        );


      if (
        !access.ok
      ) {

        return response
          .status(
            access.status
          )
          .json({

            ok: false,

            message:
              access.message

          });

      }

    }


    /* =====================================================
       RELEASE ACTUAL
    ===================================================== */

    const {
      data: release,
      error: releaseError
    } =
      await supabase

        .from(
          "releases"
        )

        .select(
          `
          version,
          manifest_path
          `
        )

        .eq(
          "instance_id",
          instance.id
        )

        .eq(
          "version",
          instance.current_version
        )

        .eq(
          "enabled",
          true
        )

        .maybeSingle();


    if (
      releaseError
    ) {

      throw releaseError;

    }


    if (
      !release
    ) {

      return response
        .status(404)
        .json({

          ok: false,

          message:
            "No active release found."

        });

    }


    /* =====================================================
       LEER MANIFEST
    ===================================================== */

    const {
      data: manifestFile,
      error: manifestError
    } =
      await supabase

        .storage

        .from(
          BUCKET
        )

        .download(
          release.manifest_path
        );


    if (
      manifestError
    ) {

      throw manifestError;

    }


    const manifest =
      JSON.parse(
        await manifestFile.text()
      );


    /* =====================================================
       VERIFICAR QUE EL ARCHIVO ESTÉ AUTORIZADO
    ===================================================== */

    const files =
      Array.isArray(
        manifest?.files
      )
        ? manifest.files
        : [];


    const manifestEntry =
      files.find(
        file =>
          String(
            file?.path || ""
          )
            .replaceAll("\\", "/") ===
          requestedPath
      );


    if (
      !manifestEntry
    ) {

      return response
        .status(404)
        .json({

          ok: false,

          message:
            "El archivo no pertenece a esta versión."

        });

    }


    if (
      manifestEntry?.source?.type !==
      "storage"
    ) {

      return response
        .status(400)
        .json({

          ok: false,

          message:
            "Este archivo no utiliza Supabase Storage."

        });

    }


    const storagePath =
      String(
        manifestEntry.source.path || ""
      ).trim();


    if (
      !storagePath
    ) {

      return response
        .status(500)
        .json({

          ok: false,

          message:
            "El manifest no contiene una fuente válida."

        });

    }


    /* =====================================================
       URL FIRMADA
    ===================================================== */

    const {
      data: signedData,
      error: signedError
    } =
      await supabase

        .storage

        .from(
          BUCKET
        )

        .createSignedUrl(
          storagePath,
          SIGNED_URL_SECONDS
        );


    if (
      signedError
    ) {

      throw signedError;

    }


    if (
      !signedData?.signedUrl
    ) {

      throw new Error(
        "Supabase no devolvió una URL firmada."
      );

    }


    /* =====================================================
       RESPUESTA
    ===================================================== */

    return response
      .status(200)
      .json({

        ok: true,

        instanceId:
          instance.id,

        version:
          release.version,

        file: {

          path:
            manifestEntry.path,

          size:
            Number(
              manifestEntry.size || 0
            ),

          sha256:
            manifestEntry.sha256,

          downloadUrl:
            signedData.signedUrl,

          expiresIn:
            SIGNED_URL_SECONDS

        }

      });


  } catch (error) {

    console.error(
      "instance file error:",
      error
    );


    return response
      .status(500)
      .json({

        ok: false,

        message:
          "No se pudo preparar la descarga."

      });

  }

}