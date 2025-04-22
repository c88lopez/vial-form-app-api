import { Static, Type } from '@sinclair/typebox'
import { Uuid } from './typebox_base'

export const FormFields = Type.Record(
  Type.String(),
  Type.Object({
    type: Type.String(),
    question: Type.String(),
    required: Type.Boolean(),
  })
)

export const Form = Type.Object({
  id: Type.Optional(Uuid()),
  name: Type.String(),
  fields: FormFields,
})

export type IForm = Static<typeof Form>
