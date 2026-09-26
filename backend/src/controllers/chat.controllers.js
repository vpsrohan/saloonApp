import { groq } from "../config/groq.js";
import {
  listSalons,
  getSalonServices,
  checkAvailability,
  getUserBookings,
} from "../tools/salon.tools.js";

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
  {
    type: "function",
    function: {
      name: "checkAvailability",
      description:
        "Check available time slots for a specific service at a specific salon, on a specific date. Use this whenever the user asks about open slots, availability, or whether a day/time is free — do NOT guess availability yourself.",
      parameters: {
        type: "object",
        properties: {
          salonName: {
            type: "string",
            description: "Exact salon name, matching the database.",
          },
          serviceName: {
            type: "string",
            description: "Exact service name offered by that salon.",
          },
          date: {
            type: "string",
            description: "Date to check, in YYYY-MM-DD format.",
          },
        },
        required: ["salonName", "serviceName", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getUserBookings",
      description:
        "Get the current logged-in user's own bookings (upcoming and past). Takes no arguments — always returns bookings for whichever user is chatting. If the user is not logged in, this will say so.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

const SYSTEM_PROMPT_BASE = `You are a helpful assistant for a salon booking app. You can help users:
- Browse active salons
- See the services and prices a salon offers
- Check available time slots for a service on a given date
- Look up their own past/upcoming bookings

You can ONLY read information using the tools provided — you cannot create, modify, or cancel a booking, and you cannot change any account or salon details. If the user asks you to book, reschedule, cancel, or edit anything (or asks for anything else this assistant isn't designed for), do NOT attempt it and do NOT pretend you did it. Instead, tell them clearly that this can't be done through chat and that they should use the app directly:
- To book: browse the salon's page and pick a service + time slot
- To cancel a booking: go to their Profile page
- To edit a salon's details: use the salon's Edit page (admins only)

Keep answers short and friendly. If a tool returns an error or no results, say so plainly rather than guessing.`;

const MAX_TOOL_ROUNDS = 4;

export const Chat = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "message is required" });
    }

    // req.user is only present if optionalAuth found a valid cookie —
    // getUserBookings below checks for this itself.
    const toolHandlers = {
      listSalons: async () => listSalons(),
      getSalonServices: async (args) => getSalonServices(args.salonName),
      checkAvailability: async (args) => checkAvailability(args),
      getUserBookings: async () => {
        if (!req.user) {
          return {
            error:
              "not_authenticated: the user is not logged in, so their bookings can't be looked up. Tell them to log in first.",
          };
        }
        return getUserBookings(req.user._id);
      },
    };

    const today = new Date().toISOString().split("T")[0];
    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\nToday's date is ${today} (YYYY-MM-DD) — use this to resolve relative dates like "today" or "tomorrow" before calling checkAvailability.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: message },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages,
        tools,
      });

      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);

      // No tool calls → the model is giving its final answer.
      if (!assistantMessage.tool_calls?.length) {
        return res.status(200).json({
          message: assistantMessage.content,
          history: messages,
        });
      }

      // Run every tool call the model asked for this round, then loop
      // again so it can chain further tool calls or give a final answer.
      for (const toolCall of assistantMessage.tool_calls) {
        const handler = toolHandlers[toolCall.function.name];
        let result;

        if (!handler) {
          result = { error: `Unknown tool: ${toolCall.function.name}` };
        } else {
          try {
            const args = toolCall.function.arguments
              ? JSON.parse(toolCall.function.arguments)
              : {};
            result = await handler(args);
          } catch (toolErr) {
            console.error(
              `Error running tool ${toolCall.function.name}:`,
              toolErr,
            );
            result = { error: "Tool execution failed" };
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    return res.status(200).json({
      message:
        "Sorry, I couldn't finish looking that up right now. Please try rephrasing your question.",
    });
  } catch (e) {
    console.error("Error in chat controller:", e);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};
