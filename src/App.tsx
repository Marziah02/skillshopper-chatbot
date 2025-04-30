"use client";
import { useEffect, useRef, useState } from "react";
import ChatbotIcon from "./components/ChatbotIcon";
import ChatForm from "./components/ChatForm";
import ChatMessage from "./components/ChatMessage";
import { companyInfo } from "./companyInfo";
import { predefinedQA } from "./predefinedQA";
import Fuse from "fuse.js";

const App: React.FC = () => {
  const chatBodyRef = useRef();
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      hideInChat: true,
      role: "model",
      text: companyInfo,
    },
  ]);

  // Basic similarity checker (token overlap percentage)

  // ✅ Token Overlap Similarity Checker (Improved)
  const getSimilarity = (str1, str2) => {
    const words1 = str1.toLowerCase().split(/\W+/);
    const words2 = str2.toLowerCase().split(/\W+/);
    const commonWords = words1.filter((word) => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  const normalizeUserMessage = (text) => {
    return text
      .toLowerCase()
      .replace(/^using the details.*?:/i, "") // Strip prompt prefix
      .trim();
  };

  const fuse = new Fuse(predefinedQA, {
    keys: ["question"],
    threshold: 0.42, // adjust for fuzziness
  });

  // const generateBotResponse = async (history) => {
  //   // Helper function to update chat history
  //   const updateHistory = (text, isError = false) => {
  //     setChatHistory((prev) => [
  //       ...prev.filter((msg) => msg.text != "Thinking..."),
  //       { role: "model", text, isError },
  //     ]);
  //   };
  //   // Format chat history for API request
  //   history = history.map(({ role, text }) => ({ role, parts: [{ text }] }));
  //   const requestOptions = {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ contents: history }),
  //   };
  //   try {
  //     // Make the API call to get the bot's response
  //     const response = await fetch(
  //       import.meta.env.VITE_API_URL,
  //       requestOptions
  //     );
  //     const data = await response.json();
  //     if (!response.ok)
  //       throw new Error(data?.error.message || "Something went wrong!");
  //     // Clean and update chat history with bot's response
  //     const apiResponseText = data.candidates[0].content.parts[0].text
  //       .replace(/\*\*(.*?)\*\*/g, "$1")
  //       .trim();
  //     updateHistory(apiResponseText);
  //   } catch (error) {
  //     // Update chat history with the error message
  //     updateHistory(error.message, true);
  //   }
  // };
  const generateBotResponse = async (history) => {
    const userMessage = normalizeUserMessage(history[history.length - 1].text);
    const result = fuse.search(userMessage);
    //const userMessage = history[history.length - 1].text;

    // Step 1: Check similarity with predefined questions
    let bestMatch = null;
    let highestSimilarity = 0;

    // for (const qa of predefinedQA) {
    //   const similarity = getSimilarity(userMessage, qa.question);
    //   console.log(
    //     `Matching "${userMessage}" with "${qa.question}" → similarity: ${similarity}`
    //   );
    //   if (similarity > highestSimilarity) {
    //     highestSimilarity = similarity;
    //     bestMatch = qa;
    //   }
    // }

    if (result.length > 0 && result[0].score <= 0.3) {
      const bestMatch = result[0].item;
      // console.log("Matched with Fuse.js:", bestMatch);
      // console.log("userMessage:", userMessage);
      //  console.log("Fuse match:", result[0]?.item);
      // console.log("Match score:", result[0]?.score);

      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== "Thinking..."),
        { role: "model", text: bestMatch.answer },
      ]);
      return;
    }

    for (const qa of predefinedQA) {
      const question = qa.question.toLowerCase();

      // NEW: Check if predefined question is a substring
      if (userMessage.includes(question)) {
        bestMatch = qa;
        highestSimilarity = 1; // Force it as top match
        break;
      }

      // Fall back to similarity
      const similarity = getSimilarity(userMessage, question);
      // console.log(
      //   `Matching "${userMessage}" with "${qa.question}" → similarity: ${similarity}`
      // );
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = qa;
      }
    }

    // ✅ Threshold match (adjust if needed)
    if (highestSimilarity >= 0.3 && bestMatch) {
      // console.log("Matched predefined QA:", bestMatch);
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== "Thinking..."),
        { role: "model", text: bestMatch.answer },
      ]);
      return;
    }

    // Step 2: Use company info context with API
    const contextPrompt = `Here is some background about our company:\n${companyInfo}\n\nUsing this info, answer the following user question:\n"${userMessage}"`;

    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== "Thinking..."),
        { role: "model", text, isError },
      ]);
    };

    const apiRequestHistory = [
      { role: "user", parts: [{ text: contextPrompt }] },
    ];

    try {
      const response = await fetch(import.meta.env.VITE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: apiRequestHistory }),
      });

      const data = await response.json();

      if (!response.ok || !data?.candidates?.length) {
        throw new Error("No relevant answer found.");
      }

      const apiResponseText = data.candidates[0].content.parts[0].text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .trim();

      if (apiResponseText.length < 10) {
        throw new Error("Response too short");
      }

      updateHistory(apiResponseText);
    } catch (error) {
      updateHistory(
        "Sorry, I couldn't find an answer to your question. Please try rephrasing or visit our website: https://skillshoper.com",
        true
      );
    }
  };
  useEffect(() => {
    // Auto-scroll whenever chat history updates
    chatBodyRef.current.scrollTo({
      top: chatBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatHistory]);

  return (
    <div className={`container ${showChatbot ? "show-chatbot" : ""}`}>
      <button
        onClick={() => setShowChatbot((prev) => !prev)}
        id="chatbot-toggler"
      >
        <span className="material-symbols-rounded">mode_comment</span>
        <span className="material-symbols-rounded">close</span>
      </button>
      <div className="chatbot-popup">
        {/* Chatbot Header */}
        <div className="chat-header">
          <div className="header-info">
            <ChatbotIcon />
            <h2 className="logo-text">Chatbot</h2>
          </div>
          <button
            onClick={() => setShowChatbot((prev) => !prev)}
            className="material-symbols-rounded"
          >
            keyboard_arrow_down
          </button>
        </div>
        {/* Chatbot Body */}
        <div ref={chatBodyRef} className="chat-body">
          <div className="message bot-message">
            <ChatbotIcon />
            <p className="message-text">
              Welcome to SkillShoper. <br /> How can I help you?
            </p>
          </div>
          {/* Render the chat history dynamically */}
          {chatHistory.map((chat, index) => (
            <ChatMessage key={index} chat={chat} />
          ))}
        </div>
        {/* Chatbot Footer */}
        <div className="chat-footer">
          <ChatForm
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            generateBotResponse={generateBotResponse}
          />
        </div>
      </div>
    </div>
  );
};
export default App;
