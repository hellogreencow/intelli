import type { ActionResponse } from "./types.ts";
const jsonBlockPattern = /```json\n([\s\S]*?)\n```/;

export const messageCompletionFooter = `\nResponse format should be formatted in a valid JSON block like this:
\`\`\`json
{ "user": "{{agentName}}", "text": "<string>", "action": "<string>" }
\`\`\`

The "action" field should be one of the options in [Available Actions] and the "text" field should be the response you want to send.
`;

export const shouldRespondFooter = `The available options are [RESPOND], [IGNORE], or [STOP]. Choose the most appropriate option.
If {{agentName}} is talking too much, you can choose [IGNORE]

Your response must include one of the options.`;

export const parseShouldRespondFromText = (
    text: string
): "RESPOND" | "IGNORE" | "STOP" | null => {
    const match = text
        .split("\n")[0]
        .trim()
        .replace("[", "")
        .toUpperCase()
        .replace("]", "")
        .match(/^(RESPOND|IGNORE|STOP)$/i);
    return match
        ? (match[0].toUpperCase() as "RESPOND" | "IGNORE" | "STOP")
        : text.includes("RESPOND")
        ? "RESPOND"
        : text.includes("IGNORE")
        ? "IGNORE"
        : text.includes("STOP")
        ? "STOP"
        : null;
};

export const booleanFooter = `Respond with only a YES or a NO.`;

/**
 * Parses a string to determine its boolean equivalent.
 *
 * Recognized affirmative values: "YES", "Y", "TRUE", "T", "1", "ON", "ENABLE".
 * Recognized negative values: "NO", "N", "FALSE", "F", "0", "OFF", "DISABLE".
 *
 * @param {string} text - The input text to parse.
 * @returns {boolean|null} - Returns `true` for affirmative inputs, `false` for negative inputs, and `null` for unrecognized inputs or null/undefined.
 */
export const parseBooleanFromText = (text: string) => {
    if (!text) return null; // Handle null or undefined input

    const affirmative = ["YES", "Y", "TRUE", "T", "1", "ON", "ENABLE"];
    const negative = ["NO", "N", "FALSE", "F", "0", "OFF", "DISABLE"];

    const normalizedText = text.trim().toUpperCase();

    if (affirmative.includes(normalizedText)) {
        return true;
    } else if (negative.includes(normalizedText)) {
        return false;
    }

    return null; // Return null for unrecognized inputs
};

export const stringArrayFooter = `Respond with a JSON array containing the values in a valid JSON block formatted for markdown with this structure:
\`\`\`json
[
  'value',
  'value'
]
\`\`\`

Your response must include the valid JSON block.`;

/**
 * Parses a JSON array from a given text. The function looks for a JSON block wrapped in triple backticks
 * with `json` language identifier, and if not found, it searches for an array pattern within the text.
 * It then attempts to parse the JSON string into a JavaScript object. If parsing is successful and the result
 * is an array, it returns the array; otherwise, it returns null.
 *
 * @param text - The input text from which to extract and parse the JSON array.
 * @returns An array parsed from the JSON string if successful; otherwise, null.
 */
export function parseJsonArrayFromText(text: string) {
    let jsonData = null;

    // First try to parse with the original JSON format
    const jsonBlockMatch = text.match(jsonBlockPattern);

    if (jsonBlockMatch) {
        try {
            // Only replace quotes that are actually being used for string delimitation
            const normalizedJson = jsonBlockMatch[1].replace(
                /(?<!\\)'([^']*)'(?=\s*[,}\]])/g,
                '"$1"'
            );
            jsonData = JSON.parse(normalizedJson);
        } catch (e) {
            console.error("Error parsing JSON:", e);
            console.error("Failed parsing text:", jsonBlockMatch[1]);
        }
    }

    // If that fails, try to find an array pattern
    if (!jsonData) {
        const arrayPattern = /\[\s*(['"])(.*?)\1\s*\]/;
        const arrayMatch = text.match(arrayPattern);

        if (arrayMatch) {
            try {
                // Only replace quotes that are actually being used for string delimitation
                const normalizedJson = arrayMatch[0].replace(
                    /(?<!\\)'([^']*)'(?=\s*[,}\]])/g,
                    '"$1"'
                );
                jsonData = JSON.parse(normalizedJson);
            } catch (e) {
                console.error("Error parsing JSON:", e);
                console.error("Failed parsing text:", arrayMatch[0]);
            }
        }
    }

    if (Array.isArray(jsonData)) {
        return jsonData;
    }

    return null;
}

/**
 * Checks if a string looks like it might be valid JSON content by attempting a safe parse
 * @param text - The text to validate
 * @returns boolean indicating if the text is valid JSON
 */
function looksLikeJson(text: string): boolean {
    const trimmed = text.trim();

    // Must start with { or [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return false;
    }

    // Must end with } or ]
    if ((trimmed.startsWith('{') && !trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && !trimmed.endsWith(']'))) {
        return false;
    }

    // Try parsing safely using JSON.parse() to verify it's valid JSON
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
}

/**
 * Cleans a JSON-like response string by removing unnecessary markers, line breaks, and extra whitespace.
 * This is useful for handling improperly formatted JSON responses from external sources.
 *
 * @param response - The raw JSON-like string response to clean.
 * @returns The cleaned string, ready for parsing or further processing.
 */
export function cleanJsonResponse(response: string): string {
    if (!response) return '';
    
    // First remove any markdown code block markers with or without language identifier
    let cleaned = response
        .replace(/```(?:json)?\n/g, "") // Remove opening ```json or ``` markers
        .replace(/\n```/g, "")          // Remove closing ``` markers
        .replace(/`/g, "")              // Remove any remaining backticks
        .trim();

    // Only extract JSON content if we can find clear JSON boundaries
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    
    let extracted = '';
    // Determine if we have a valid JSON object or array structure
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        extracted = cleaned.slice(firstBrace, lastBrace + 1);
    } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        extracted = cleaned.slice(firstBracket, lastBracket + 1);
    }

    // Only return if it's valid JSON
    if (extracted && looksLikeJson(extracted)) {
        return extracted;
    }

    return '';
}

/**
 * Attempts to extract a valid JSON content from text, handling various formats and edge cases.
 * @param text - The text potentially containing JSON.
 * @returns The extracted JSON string or null if no valid JSON found.
 */
function extractJsonContent(text: string): { content: string; source: 'markdown' | 'raw' | 'fallback' } | null {
    if (!text) return null;

    // First try to find JSON within code blocks
    const codeBlockMatch = text.match(jsonBlockPattern);
    if (codeBlockMatch && codeBlockMatch[1].trim()) {
        const content = codeBlockMatch[1].trim();
        if (looksLikeJson(content)) {
            return { content, source: 'markdown' };
        }
    }

    // If no code block, try to extract clean JSON
    const cleaned = cleanJsonResponse(text);
    if (cleaned && looksLikeJson(cleaned)) {
        return { content: cleaned, source: 'raw' };
    }

    // Only use fallback for text that has clear key-value structure
    if (text.includes(":") && text.includes('"')) {
        const fallbackContent = text.trim();
        // Additional validation for key-value structure
        const hasValidKeyValuePair = /"[^"]+":\s*"[^"]+"/.test(fallbackContent);
        if (hasValidKeyValuePair) {
            return { content: fallbackContent, source: 'fallback' };
        }
    }

    return null;
}

/**
 * Parses a JSON object from a given text, with multiple fallback mechanisms.
 * @param text - The input text from which to extract and parse the JSON object.
 * @returns An object parsed from the JSON string if successful; otherwise, null or the result of parsing an array.
 */
export function parseJSONObjectFromText(
    text: string
): Record<string, any> | null {
    if (!text) return null;

    let jsonData = null;
    const extracted = extractJsonContent(text);

    if (!extracted) {
        // If text doesn't look like JSON, return null
        if (!text.includes(":") || !text.includes('"')) {
            return null;
        }

        // Try attribute extraction only if the text has JSON-like key-value pairs
        return extractAttributes(text);

    }

    // Try parsing from extracted content
    try {
        const parsingText = normalizeJsonString(extracted.content);
        // Double-check that normalized content is valid JSON
        if (looksLikeJson(parsingText)) {
            jsonData = JSON.parse(parsingText);
        }
    } catch (e) {
        console.error(`Error parsing JSON from ${extracted.source}:`, e);
        console.debug('Failed content:', extracted.content.slice(0, 100) + '...');
        
        // Handle fallback cases
        if (extracted.source === 'fallback') {
            return extractAttributes(extracted.content);
        } else if (extracted.source === 'markdown') {
            // If markdown parsing failed, try raw cleanup
            const rawExtracted = cleanJsonResponse(text);
            if (rawExtracted && looksLikeJson(rawExtracted)) {
                try {
                    const rawParsed = normalizeJsonString(rawExtracted);
                    jsonData = JSON.parse(rawParsed);
                } catch {
                    return extractAttributes(extracted.content);
                }
            }
        }
    }

    if (jsonData && typeof jsonData === "object") {
        if (!Array.isArray(jsonData)) {
            return jsonData;
        } else if (jsonData.length > 0) {
            // Only return non-empty arrays
            return jsonData;
        }
    }

    return null;
}

/**
 * Extracts specific attributes (e.g., user, text, action) from a JSON-like string using regex.
 * @param response - The cleaned string response to extract attributes from.
 * @param attributesToExtract - An array of attribute names to extract.
 * @returns An object containing the extracted attributes.
 */
export function extractAttributes(
    response: string,
    attributesToExtract?: string[]
): { [key: string]: string | undefined } {
    response = response.trim();
    const attributes: { [key: string]: string | undefined } = {};

    if (!attributesToExtract || attributesToExtract.length === 0) {
        // Extract all attributes if no specific attributes are provided
        const matches = response.matchAll(/"([^"]+)"\s*:\s*"([^"]*)"?/g);
        for (const match of matches) {
            attributes[match[1]] = match[2];
        }
    } else {
        // Extract only specified attributes
        attributesToExtract.forEach((attribute) => {
            const match = response.match(
                new RegExp(`"${attribute}"\\s*:\\s*"([^"]*)"?`, "i")
            );
            if (match) {
                attributes[attribute] = match[1];
            }
        });
    }

    return attributes;
}

/**
 * Normalizes a JSON-like string by correcting formatting issues:
 * - Removes extra spaces after '{' and before '}'.
 * - Wraps unquoted values in double quotes.
 * - Converts single-quoted values to double-quoted.
 * - Ensures consistency in key-value formatting.
 * - Normalizes mixed adjacent quote pairs.
 *
 * This is useful for cleaning up improperly formatted JSON strings
 * before parsing them into valid JSON.
 *
 * @param str - The JSON-like string to normalize.
 * @returns A properly formatted JSON string.
 */

export const normalizeJsonString = (str: string) => {
    // Remove extra spaces after '{' and before '}'
    str = str.replace(/\{\s+/, '{').replace(/\s+\}/, '}').trim();

    // "key": unquotedValue → "key": "unquotedValue"
    str = str.replace(
      /("[\w\d_-]+")\s*: \s*(?!"|\[)([\s\S]+?)(?=(,\s*"|\}$))/g,
      '$1: "$2"',
    );

    // "key": 'value' → "key": "value"
    str = str.replace(
      /"([^"]+)"\s*:\s*'([^']*)'/g,
      (_, key, value) => `"${key}": "${value}"`,
    );

    // "key": someWord → "key": "someWord"
    str = str.replace(/("[\w\d_-]+")\s*:\s*([A-Za-z_]+)(?!["\w])/g, '$1: "$2"');

    // Replace adjacent quote pairs with a single double quote
    str = str.replace(/(?:"')|(?:'")/g, '"');
    return str;
};

export const postActionResponseFooter = `Choose any combination of [LIKE], [RETWEET], [QUOTE], and [REPLY] that are appropriate. Each action must be on its own line. Your response must only include the chosen actions.`;

export const parseActionResponseFromText = (
    text: string
): { actions: ActionResponse } => {
    const actions: ActionResponse = {
        like: false,
        retweet: false,
        quote: false,
        reply: false,
    };

    // Regex patterns
    const likePattern = /\[LIKE\]/i;
    const retweetPattern = /\[RETWEET\]/i;
    const quotePattern = /\[QUOTE\]/i;
    const replyPattern = /\[REPLY\]/i;

    // Check with regex
    actions.like = likePattern.test(text);
    actions.retweet = retweetPattern.test(text);
    actions.quote = quotePattern.test(text);
    actions.reply = replyPattern.test(text);

    // Also do line by line parsing as backup
    const lines = text.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "[LIKE]") actions.like = true;
        if (trimmed === "[RETWEET]") actions.retweet = true;
        if (trimmed === "[QUOTE]") actions.quote = true;
        if (trimmed === "[REPLY]") actions.reply = true;
    }

    return { actions };
};

/**
 * Truncate text to fit within the character limit, ensuring it ends at a complete sentence.
 */
export function truncateToCompleteSentence(
    text: string,
    maxLength: number
): string {
    if (text.length <= maxLength) {
        return text;
    }

    // Attempt to truncate at the last period within the limit
    const lastPeriodIndex = text.lastIndexOf(".", maxLength - 1);
    if (lastPeriodIndex !== -1) {
        const truncatedAtPeriod = text.slice(0, lastPeriodIndex + 1).trim();
        if (truncatedAtPeriod.length > 0) {
            return truncatedAtPeriod;
        }
    }

    // If no period, truncate to the nearest whitespace within the limit
    const lastSpaceIndex = text.lastIndexOf(" ", maxLength - 1);
    if (lastSpaceIndex !== -1) {
        const truncatedAtSpace = text.slice(0, lastSpaceIndex).trim();
        if (truncatedAtSpace.length > 0) {
            return truncatedAtSpace + "...";
        }
    }

    // Fallback: Hard truncate and add ellipsis
    const hardTruncated = text.slice(0, maxLength - 3).trim();
    return hardTruncated + "...";
}

