import { groq } from "../config/groq.js";
import { listSalons, getSalonServices } from "../tools/salon.tools.js";

const tools = [
  {
    type: "function",
    function: {
      name: "listSalons",
      description: "Get all currently active salons",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSalonServices",
      description:
        "Get the active services offered by a salon. The salonName must exactly match the salon name stored in the database. Do not add words such as 'Salon' to the name.",
      parameters: {
        type: "object",
        properties: {
          salonName: {
            type: "string",
            description: "The name of the salon",
          },
        },
        required: ["salonName"],
      },
    },
  },
];

export const Chat = async (req, res) => {
  try {
    const { message } = req.body;

    // 1. Ask the LLM what to do
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
      tools,
    });

    //console.log(response);
    const assistantMessage = response.choices[0].message;
    console.log(JSON.stringify(assistantMessage.tool_calls, null, 2));
    // 2. Did the LLM ask us to use a tool?
    if (assistantMessage.tool_calls) {
      const toolCall = assistantMessage.tool_calls[0];

      // 3. Execute the requested tool
      if (toolCall.function.name === "listSalons") {
        const salons = await listSalons();

        // 4. Give the tool result back to the LLM
        const finalResponse = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",

          messages: [
            {
              role: "user",
              content: message,
            },
            {
              role: "assistant",
              tool_calls: assistantMessage.tool_calls,
            },
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(salons),
            },
          ],
        });

        // 5. Send the LLM's final answer to the user
        return res.status(200).json({
          message: finalResponse.choices[0].message.content,
        });
      }

      if (toolCall.function.name === "getSalonServices") {
        const args = JSON.parse(toolCall.function.arguments);
        const services = await getSalonServices(args.salonName);

        const finalResponse = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",

          messages: [
            {
              role: "user",
              content: message,
            },
            assistantMessage,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(services),
            },
          ],

          tool_choice: "none",
        });

        return res.status(200).json({
          message: finalResponse.choices[0].message.content,
        });
      }
    }

    // If the LLM didn't use a tool
    return res.status(200).json({
      message: assistantMessage.content,
    });
  } catch (e) {
    console.error("Error in chat controller:", e);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};
