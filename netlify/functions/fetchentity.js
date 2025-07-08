import OpenAI from "openai";
import { traceable } from "langsmith/traceable";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const handler = traceable(async (event) => {
    // 添加CORS头部
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // 验证请求方法
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: "Method not allowed" })
            };
        }

        // 解析请求体
        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Invalid JSON in request body" })
            };
        }

        const { userMessage } = requestBody;

        // 验证必需参数
        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing or invalid user message" })
            };
        }

        // 验证消息长度
        if (userMessage.length > 2000) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Message too long. Maximum 2000 characters allowed." })
            };
        }

        console.log('开始分析用户消息:', userMessage.substring(0, 100) + '...');

        const prompt = `Analyze the user's conversation content and extract all entity information and the user's emotional tendencies toward them.

### Example Analysis:

User conversation: "I really love my girlfriend Lily, she especially loves eating chocolate and strawberry cake. But I don't really like her cat, it's always so noisy. We often go to Starbucks for coffee, the environment there is nice, but the price is a bit expensive."

Entity Emotion Analysis:
People:
- Lily (girlfriend): like
- I: uncertain

Items:
- chocolate: uncertain
- strawberry cake: uncertain
- cat: dislike
- coffee: uncertain

Places:
- Starbucks: like

Others:
- environment: like
- price: dislike

###

User conversation: "${userMessage}"

Entity Emotion Analysis:`;

        // 调用OpenAI API
        const response = await openai.completions.create({
            model: 'gpt-3.5-turbo-instruct',
            prompt: prompt,
            presence_penalty: 0,
            frequency_penalty: 0.3,
            max_tokens: 300,
            temperature: 0.1,
        });

        console.log('OpenAI API调用成功');

        // 解析AI响应并提取结构化数据
        const analysisText = response.choices[0].text.trim();
        console.log('AI分析结果:', analysisText);

        const parsedEntities = parseEntitiesFromText(analysisText);
        console.log('解析后的实体:', parsedEntities);

        const summary = generateSummary(parsedEntities);
        console.log('生成的摘要:', summary);

        // 返回成功响应
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                originalMessage: userMessage,
                analysis: analysisText,
                entities: parsedEntities,
                summary: summary
            })
        };

    } catch (error) {
        console.error("实体情感分析错误:", error);

        // 检查是否是OpenAI API错误
        if (error.code === 'insufficient_quota') {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({
                    error: "API quota exceeded. Please try again later."
                })
            };
        }

        if (error.code === 'rate_limit_exceeded') {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({
                    error: "Rate limit exceeded. Please try again later."
                })
            };
        }

        // 通用错误响应
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Internal server error. Please try again later.",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
}, {
    name: "analyzeEntityEmotion",
    project: process.env.LANGSMITH_PROJECT
});

// 解析AI响应文本并提取结构化实体数据
function parseEntitiesFromText(text) {
    const entities = {
        People: [],
        Items: [],
        Places: [],
        Others: []
    };

    try {
        const lines = text.split('\n').filter(line => line.trim());
        let currentCategory = '';

        lines.forEach(line => {
            const trimmedLine = line.trim();

            // 检测类别标题
            if (trimmedLine.endsWith(':') && ['People:', 'Items:', 'Places:', 'Others:'].includes(trimmedLine)) {
                currentCategory = trimmedLine.replace(':', '');
                return;
            }

            // 解析实体和情感
            if (trimmedLine.startsWith('-') && currentCategory) {
                // 改进的正则表达式，支持更多格式
                const match = trimmedLine.match(/- (.+?)(?:\s*\((.+?)\))?\s*:\s*(like|dislike|uncertain)/) ||
                             trimmedLine.match(/- (.+?)(?:\s*\((.+?)\))?\s+(like|dislike|uncertain)/);

                if (match) {
                    const [, entityName, description, emotion] = match;

                    // 确保当前类别存在
                    if (entities[currentCategory]) {
                        entities[currentCategory].push({
                            name: entityName.trim(),
                            description: description ? description.trim() : '',
                            emotion: emotion,
                            emotionScore: getEmotionScore(emotion)
                        });
                    }
                }
            }
        });

        console.log('实体解析完成:', entities);
        return entities;

    } catch (parseError) {
        console.error('实体解析错误:', parseError);
        // 返回空的实体结构
        return {
            People: [],
            Items: [],
            Places: [],
            Others: []
        };
    }
}

// 将情感转换为数值分数
function getEmotionScore(emotion) {
    switch (emotion) {
        case 'like': return 1;
        case 'dislike': return -1;
        case 'uncertain': return 0;
        default: return 0;
    }
}

// 生成情感分析摘要
function generateSummary(entities) {
    let totalEntities = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    try {
        Object.values(entities).forEach(categoryEntities => {
            if (Array.isArray(categoryEntities)) {
                categoryEntities.forEach(entity => {
                    totalEntities++;
                    if (entity.emotionScore > 0) positiveCount++;
                    else if (entity.emotionScore < 0) negativeCount++;
                    else neutralCount++;
                });
            }
        });

        // 确定整体情感倾向
        let sentiment = 'neutral';
        if (positiveCount > negativeCount) {
            sentiment = 'positive';
        } else if (negativeCount > positiveCount) {
            sentiment = 'negative';
        }

        return {
            totalEntities,
            emotions: {
                positive: positiveCount,
                negative: negativeCount,
                neutral: neutralCount
            },
            sentiment: sentiment
        };

    } catch (summaryError) {
        console.error('摘要生成错误:', summaryError);
        return {
            totalEntities: 0,
            emotions: {
                positive: 0,
                negative: 0,
                neutral: 0
            },
            sentiment: 'neutral'
        };
    }
}

export { handler };