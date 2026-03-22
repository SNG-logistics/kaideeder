import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/lib/api'
import { pickTier, checkBudget } from '@/lib/ai-router'
import { getAiConfig } from '@/lib/ai-config'

const SYSTEM_PROMPT = `You are an AI assistant for KAIDEEDER — a multi-tenant Restaurant & Stock Management Platform.
You help with stock management, recipes, menu planning, and general restaurant operations.
Currency: LAK (กีบ). Answer in Thai unless the user writes in English.
Be concise, practical, and helpful. Use bullet points when listing items.`


interface ChatMessage {
    role: string
    content: string
}

interface ChatBody {
    messages: ChatMessage[]
    context?: string
}

/**
 * POST /api/ai/chat
 * Body: { messages: [{role, content}], context?: string }
 * Returns: { reply, model, tier, tokensUsed }
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = (await req.json()) as ChatBody
        const { messages, context } = body

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return err('กรุณาส่งข้อความ')
        }

        const { apiKey, apiUrl, model } = getAiConfig()
        if (!apiKey) {
            return err('ไม่พบ COMET_API_KEY ใน .env')
        }

        // Check budget
        const budget = checkBudget()
        if (!budget.allowed) {
            return err(budget.reason || 'งบ AI หมดแล้ว')
        }

        // Pick tier modifiers (use base model from config, tier affects temperature/tokens)
        const tier = pickTier(messages)
        const maxTokens = tier === 'pro' ? 4096 : tier === 'mid' ? 2048 : 1024

        // Build messages with system prompt
        const systemContent = context
            ? `${SYSTEM_PROMPT}\n\nบริบทเพิ่มเติม:\n${context}`
            : SYSTEM_PROMPT

        const apiMessages = [
            { role: 'system', content: systemContent },
            ...messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            })),
        ]

        // Call CometAPI
        let reply: string
        let tokensUsed = 0

        try {
            const result = await callCometAPI(apiKey, apiUrl, model, apiMessages, maxTokens)
            reply = result.reply
            tokensUsed = result.tokensUsed
        } catch (primaryError) {
            console.error(`CometAPI (${model}) failed:`, primaryError)
            return err('AI ไม่สามารถตอบได้ในขณะนี้ กรุณาลองใหม่')
        }

        return ok({
            reply,
            model,
            tier,
            tokensUsed,
        })
    } catch (error) {
        console.error('AI chat error:', error)
        return err('เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
    }
})

async function callCometAPI(
    apiKey: string,
    apiUrl: string,
    model: string,
    messages: { role: string; content: string }[],
    maxTokens = 2048,
): Promise<{ reply: string; tokensUsed: number }> {
    const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
            temperature: 0.7,
            max_tokens: maxTokens,
        }),
    })

    if (!response.ok) {
        const errText = await response.text()
        console.error(`CometAPI error (${response.status}):`, errText)
        throw new Error(`CometAPI error: ${response.status}`)
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content?.trim() || ''
    const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)

    if (!reply) {
        throw new Error('Empty response from AI')
    }

    return { reply, tokensUsed }
}
