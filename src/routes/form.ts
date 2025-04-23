import { FastifyInstance } from 'fastify'

import { Form } from '@prisma/client'

import prisma from '../db/db_client'
import { serializer } from './middleware/pre_serializer'
import { IEntityId } from './schemas/common'
import { ApiError } from '../errors'
import { IForm, IFormRecord } from './schemas/form'

async function formRoutes(app: FastifyInstance) {
  app.setReplySerializer(serializer)

  const log = app.log.child({ component: 'formRoutes' })

  app.get<{
    Reply: Form[]
  }>('/', {
    async handler(req, reply) {
      log.debug('get forms')
      try {
        const forms = await prisma.form.findMany()
        reply.send(forms)
      } catch (err: any) {
        log.error({ err }, err.message)
        throw new ApiError('failed to fetch form', 400)
      }
    },
  })

  app.get<{
    Params: IEntityId
    Reply: IForm
  }>('/:id', {
    async handler(req, reply) {
      const { params } = req
      const { id } = params
      log.debug('get form by id')
      try {
        const form = await prisma.form.findUniqueOrThrow({ where: { id } })
        reply.send({
          name: form.name,
          fields: form.fields as IForm['fields'],
        })
      } catch (err: any) {
        log.error({ err }, err.message)
        throw new ApiError('failed to fetch form', 400)
      }
    },
  })

  app.post<{
    Body: IForm
    Reply: IForm
  }>('/', {
    async handler(req, reply) {
      const { body } = req
      log.debug('create form')
      log.debug({ body })

      try {
        const form = await prisma.form.create({
          data: { name: body.name, fields: body.fields },
        })
        reply.send({
          id: form.id,
          name: form.name,
          fields: form.fields as IForm['fields'],
        })
      } catch (err: any) {
        log.error({ err }, err.message)
        throw new ApiError('failed to create form', 400)
      }
    },
  })

  const validateRequiredFields = (
    formFields: Form['fields'],
    newRecord: any
  ) => {
    const fields = formFields as unknown as IForm['fields']
    const fieldsKeys = Object.keys(fields)
    for (let index = 0; index < fieldsKeys.length; index++) {
      if (fields[index] && !fields[index].required) {
        continue
      }

      if (!newRecord.answers[fieldsKeys[index]]) {
        throw new Error(`Expected answer for field "${fieldsKeys[index]}"`)
      }
    }
  }

  app.post<{
    Params: IEntityId
    Body: IFormRecord
    Reply: IForm
  }>('/:id/add-record', {
    async handler(req, reply) {
      const { params, body } = req
      log.debug('add form data record', { params, body })
      try {
        const form = await prisma.form.findUniqueOrThrow({
          where: {
            id: params.id,
          },
        })

        validateRequiredFields(form.fields, body)

        await prisma.$transaction(async tx => {
          const sourceRecord = await tx.sourceRecord.create({
            data: {
              formId: form.id,
            },
          })

          const fields = form.fields as unknown as IForm['fields']
          const fieldsKeys = Object.keys(fields)

          return tx.sourceData.createMany({
            data: fieldsKeys.map(fieldKey => {
              return {
                sourceRecordId: sourceRecord.id,
                question: fields[fieldKey].question,
                answer: body.answers[fieldKey],
              }
            }),
          })
        })
      } catch (err: any) {
        log.error({ err }, err.message)
        throw new ApiError('failed to create form record', 400)
      }
    },
  })
}

export default formRoutes
