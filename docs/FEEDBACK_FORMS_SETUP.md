# Founding customer feedback forms setup

The homepage has two Netlify Forms:

- `feedback`: product ideas, purchase objections, and the 7-day/14-day founding customer check-ins.
- `contact`: technical support, billing, complaints, and general messages.

Both forms submit without taking the visitor away from the page. Spam honeypot protection is enabled on the feedback form.

## 1. Connect Netlify Forms

1. Deploy this repository to Netlify.
2. In the Netlify project, open **Forms** and enable form detection.
3. Trigger a fresh deploy after enabling detection. Netlify discovers the static HTML form definitions during deployment.
4. Open the live homepage and submit one clearly labeled test response through each form.
5. Return to **Forms** and confirm both `feedback` and `contact` appear with the correct fields.
6. Delete the test submissions after confirming the workflow.

## 2. Configure notifications

1. Open **Project configuration → Notifications → Form submission notifications**.
2. Add an email notification for `feedback` to `ITBB@intheblackbudget.com`.
3. Add a separate notification for `contact` to the same inbox.
4. Use distinct subject lines so support requests are not mixed with research responses.
5. If spam becomes a problem, enable Netlify's additional spam controls or add a CAPTCHA later; do not add friction before it is needed.

## 3. Use the founding customer check-ins

### Day 7

Send the customer a short personal note with a link to:

`https://intheblackbudget.com/#feedback`

Ask them to choose **7-day check-in** and answer:

- Were you able to open and start using the workbook?
- What was confusing or slower than expected?
- Which feature has been most useful?
- What almost stopped you from purchasing?

### Day 14

Send the same link and ask them to choose **14-day check-in**. Ask:

- Have you returned to the workbook since the first use?
- What changed in how you understand or plan your money?
- What would make the product more valuable?
- Would you recommend it to someone in a similar situation?

Feedback is appreciated but never required for the $36 price.

## 4. Testimonial permission

The form only grants permission to contact the customer about a possible testimonial. It does not grant permission to publish their words.

When feedback is strong:

1. Draft the exact quotation you want to use.
2. Email it to the customer with the proposed name format, such as first name and last initial.
3. Ask for explicit written approval to publish that exact quote.
4. Save the approval with the submission record.
5. Do not publish a photo, job title, location, or other identifying detail unless each item is separately approved.

## 5. Organize results

Export submissions weekly and track:

- Purchase stage
- Product purchased
- Primary reason for buying
- Primary objection
- Activation success
- Most useful feature
- Confusion or support issue
- Requested improvement
- Recommendation language
- Testimonial contact permission
- Publication approval status

Review patterns after 5, 10, and 20 customers. Change the website only when an objection or point of confusion repeats; preserve one-off ideas for later review.

## 6. Privacy and retention

Only request the information needed to learn from customers and provide support. Do not ask customers to paste account numbers, financial statements, or sensitive financial data into the form. Limit access to submissions, export only when needed, and delete records that no longer have a business or legal purpose.
