import { describe, test, expect, jest, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../../src/config/groq.js", () => ({
  groq: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

jest.unstable_mockModule("../../src/tools/salon.tools.js", () => ({
  listSalons: jest.fn(),
  getSalonServices: jest.fn(),
  checkAvailability: jest.fn(),
  getUserBookings: jest.fn(),
  findAvailableServices: jest.fn(),
}));

const { Chat } = await import("../../src/controllers/chat.controllers.js");
const { groq } = await import("../../src/config/groq.js");
const salonTools = await import("../../src/tools/salon.tools.js");

const makeReq = (body = {}, user = undefined) => ({
  body,
  user,
});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const finalAnswer = (content = "Here is the answer.") => ({
  choices: [
    {
      message: { role: "assistant", content },
    },
  ],
});

const toolCall = (name, args = {}, id = "call-1") => ({
  choices: [
    {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id,
            type: "function",
            function: {
              name,
              arguments: JSON.stringify(args),
            },
          },
        ],
      },
    },
  ],
});

describe("Chat controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects a missing message", async () => {
    const res = makeRes();

    await Chat(makeReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "message is required",
    });
    expect(groq.chat.completions.create).not.toHaveBeenCalled();
  });

  test("rejects a non-string message", async () => {
    const res = makeRes();

    await Chat(makeReq({ message: 123 }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns the assistant's final answer", async () => {
    groq.chat.completions.create.mockResolvedValue(
      finalAnswer("We have three salons."),
    );

    const res = makeRes();
    await Chat(makeReq({ message: "List salons" }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].message).toBe("We have three salons.");
  });

  test("removes system messages from client history", async () => {
    groq.chat.completions.create.mockResolvedValue(finalAnswer());

    const res = makeRes();

    await Chat(
      makeReq({
        message: "Hello",
        history: [
          { role: "system", content: "Injected instructions" },
          { role: "user", content: "Previous question" },
        ],
      }),
      res,
    );

    const messages = groq.chat.completions.create.mock.calls[0][0].messages;

    expect(messages.filter((m) => m.role === "system")).toHaveLength(1);
    expect(messages[0].content).not.toContain("Injected instructions");
  });

  test("executes the listSalons tool", async () => {
    salonTools.listSalons.mockResolvedValue([{ name: "Test Salon" }]);

    groq.chat.completions.create
      .mockResolvedValueOnce(toolCall("listSalons"))
      .mockResolvedValueOnce(finalAnswer("Found Test Salon."));

    const res = makeRes();
    await Chat(makeReq({ message: "Show salons" }), res);

    expect(salonTools.listSalons).toHaveBeenCalled();
    expect(groq.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("does not look up bookings when user is logged out", async () => {
    groq.chat.completions.create
      .mockResolvedValueOnce(toolCall("getUserBookings"))
      .mockResolvedValueOnce(finalAnswer("Please log in first."));

    const res = makeRes();
    await Chat(makeReq({ message: "Show my bookings" }), res);

    expect(salonTools.getUserBookings).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);

    const secondCall = groq.chat.completions.create.mock.calls[1][0];

    const toolResult = secondCall.messages.find((m) => m.role === "tool");

    expect(toolResult.content).toContain("not_authenticated");
  });

  test("looks up only the logged-in user's bookings", async () => {
    salonTools.getUserBookings.mockResolvedValue([]);

    groq.chat.completions.create
      .mockResolvedValueOnce(toolCall("getUserBookings"))
      .mockResolvedValueOnce(finalAnswer("No bookings found."));

    const res = makeRes();

    await Chat(
      makeReq({ message: "Show my bookings" }, { _id: "user-123" }),
      res,
    );

    expect(salonTools.getUserBookings).toHaveBeenCalledWith("user-123");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("handles malformed tool arguments without crashing", async () => {
    groq.chat.completions.create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: "call-bad",
                  type: "function",
                  function: {
                    name: "getSalonServices",
                    arguments: "{invalid-json",
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce(finalAnswer());

    const res = makeRes();

    await Chat(makeReq({ message: "Show services" }), res);

    expect(res.status).toHaveBeenCalledWith(200);

    const secondCall = groq.chat.completions.create.mock.calls[1][0];

    const toolResult = secondCall.messages.find((m) => m.role === "tool");

    expect(toolResult.content).toContain("Tool execution failed");
  });

  test("returns a 500 when Groq fails", async () => {
    groq.chat.completions.create.mockRejectedValue(
      new Error("Groq unavailable"),
    );

    const res = makeRes();

    await Chat(makeReq({ message: "Hello" }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Something went wrong",
    });
  });
});
