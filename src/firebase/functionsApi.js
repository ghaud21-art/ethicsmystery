import { httpsCallable } from 'firebase/functions'
import { functions } from './firebaseConfig'

const verifySchoolCodeCallable = httpsCallable(functions, 'verifySchoolCode')
const getAiFeedbackCallable = httpsCallable(functions, 'getAiFeedback')

export async function verifySchoolCode(code) {
  const result = await verifySchoolCodeCallable({ code })
  return result.data
}

export async function getAiFeedback({ reflectionLogId, prompt }) {
  const result = await getAiFeedbackCallable({ reflectionLogId, prompt })
  return result.data
}
