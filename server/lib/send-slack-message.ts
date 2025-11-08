export interface SlackMessageBlock {
  title: string
  richTextBody?: string
  jsonString?: string
  approveUploadActionUrl?: string
}
export default async (slackWebhookUrl: string, payload: SlackMessageBlock) => {
  if (!slackWebhookUrl) {
    throw new Error('SLACK_WEBHOOK_URL environment variable is not set.')
  }

  const content = {
    text: payload.title,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: payload.title,
        },
      },
    ],
  }
  if (payload.richTextBody) {
    content.blocks.push({
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements: [
            {
              type: 'text',
              text: payload.richTextBody,
            },
          ],
        },
      ],

    })
  }
  if (payload.jsonString) {
    content.blocks.push({
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_preformatted',
          elements: [
            {
              type: 'text',
              text: payload.jsonString,
            },
          ],
          border: 0,
        },
      ],
    })
  }
  if (payload.approveUploadActionUrl) {
    content.blocks.push(
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Approve algolia upload',
            },
            style: 'primary',
            url: payload.approveUploadActionUrl,
          },
        ],
      },
    )
  }

  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(content),
    })
    if (!response.ok) {
      console.error('Slack API error:', await response.json())
      throw new Error(`Slack API error: ${response.statusText}`)
    }

    return { success: true }
  }
  catch (error) {
    console.error('Error sending message to Slack:', error.message)
    return { success: false, error: error.message }
  }
}
