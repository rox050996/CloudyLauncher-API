import {
  supabase
} from "../../../lib/supabase.js";


export default async function handler(
  request,
  response
) {

  /* =====================================================
     SOLO GET
  ===================================================== */

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


  /* =====================================================
     ID DE INSTANCIA
  ===================================================== */

  const {
    id
  } =
    request.query;


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


  try {

    /* ===================================================
       BUSCAR INSTANCIA
    =================================================== */

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


    /* ===================================================
       BUSCAR RELEASE ACTUAL
    =================================================== */

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
          manifest_path,
          total_size,
          notes,
          published_at
          `
        )

        .eq(
          "instance_id",
          id
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


    /* ===================================================
       LEER MANIFEST PRIVADO DE STORAGE
    =================================================== */

    const {
      data: manifestFile,
      error: manifestError
    } =
      await supabase

        .storage

        .from(
          "launcher-files"
        )

        .download(
          release.manifest_path
        );


    if (
      manifestError
    ) {

      throw manifestError;

    }


    const manifestText =
      await manifestFile.text();


    const manifest =
      JSON.parse(
        manifestText
      );


    /* ===================================================
       RESPUESTA
    =================================================== */

    return response
      .status(200)
      .json({

        ok: true,

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

        },


        release: {

          version:
            release.version,

          totalSize:
            Number(
              release.total_size || 0
            ),

          notes:
            release.notes,

          publishedAt:
            release.published_at

        },


        manifest

      });


  } catch (error) {

    console.error(
      "latest release error:",
      error
    );


    return response
      .status(500)
      .json({

        ok: false,

        message:
          "No se pudo obtener la versión más reciente.",

        /*
         * Solo durante desarrollo.
         * Luego quitaremos detail antes del release público.
         */
        detail:
          error?.message || null

      });

  }

}