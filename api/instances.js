import {
  supabase
} from "../lib/supabase.js";


export default async function handler(
  request,
  response
) {

  if (
    request.method !==
    "GET"
  ) {

    return response
      .status(405)
      .json({
        ok: false,
        message: "Method not allowed."
      });

  }


  try {

    const {
      data,
      error
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
          "enabled",
          true
        )

        .order(
          "name",
          {
            ascending: true
          }
        );


    if (
      error
    ) {

      throw error;

    }


    return response
      .status(200)
      .json({

        ok: true,

        instances:
          data || []

      });


  } catch (error) {

    console.error(
      "instances error:",
      error
    );


    return response
      .status(500)
      .json({

        ok: false,

        message:
          "No se pudieron cargar las instancias."

      });

  }

}