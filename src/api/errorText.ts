import { ApiError } from './client'

// 오류 문구 규칙(디자인 시스템 05-patterns "오류 문구")
// 1. 무엇이 안 됐는지와 왜 그런지를 쓴다. 2. 다음에 할 일을 쓴다. 3. 오류 코드, 영어, "죄송합니다" 같은 말은 쓰지 않는다.
// 서버 메시지(~습니다)는 화면에 그대로 내보내지 않는다. 처음 보는 코드는 기본 문구로 보여 준다.

// 관리자 화면이면 개발팀, 장학생 화면이면 담당자에게 묻게 한다
function askHelp() {
  return window.location.pathname.includes('/manager') ? '개발팀에 알려 주세요' : '담당자에게 알려 주세요'
}

const REFRESH = '새로고침해서 지금 상태를 확인하세요.'

const TEXT: Record<string, () => string> = {
  // 연결, 서버
  NETWORK_ERROR: () => '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요.',
  INTERNAL_SERVER_ERROR: () => `서버 문제로 처리하지 못했어요. 다시 해도 안 되면 ${askHelp()}.`,
  STORAGE_UNAVAILABLE: () => `파일 저장소에 연결되지 않아요. 잠시 뒤에도 안 되면 ${askHelp()}.`,
  MAIL_UNAVAILABLE: () => '메일 서버가 아직 설정되지 않아 보낼 수 없어요. 개발팀에 알려 주세요.',

  // 로그인, 권한
  UNAUTHORIZED: () => '로그인 시간이 지났어요. 다시 로그인하세요.',
  ACCESS_DENIED: () => '이 계정으로는 할 수 없는 작업이에요.',
  LOGIN_FAILED: () => '이메일이나 비밀번호가 맞지 않아요.',
  ACCOUNT_DISABLED: () => '사용 중지된 계정이에요. 담당자에게 문의하세요.',
  ACCOUNT_LOCKED: () => '잠긴 계정이에요. 담당자에게 잠금 해제를 요청하세요.',
  PASSWORD_MISMATCH: () => '지금 비밀번호가 맞지 않아요.',
  SAME_AS_CURRENT: () => '지금 비밀번호와 다른 비밀번호를 입력하세요.',

  // 입력값
  INVALID_REQUEST: () => '형식이 맞지 않는 항목이 있어요. 입력한 내용을 확인하세요.',
  VALIDATION_ERROR: () => '형식이 맞지 않는 항목이 있어요. 입력한 내용을 확인하세요.',
  DUPLICATE_EMAIL: () => '이미 등록된 이메일이에요.',
  DUPLICATE_COHORT: () => '같은 이름의 기수가 이미 있어요. 목록에서 고르세요.',

  // 찾을 수 없음
  RESOURCE_NOT_FOUND: () => '찾는 내용이 없어요. 지워졌거나 주소가 바뀌었을 수 있어요.',
  SCHOLAR_NOT_FOUND: () => '장학생을 찾을 수 없어요. 목록에서 다시 확인하세요.',
  REQUEST_NOT_FOUND: () => '요청을 찾을 수 없어요. 지워졌거나 아직 공개되지 않았어요.',
  SUBMISSION_NOT_FOUND: () => '제출을 찾을 수 없어요. 목록에서 다시 확인하세요.',
  COHORT_NOT_FOUND: () => '기수를 찾을 수 없어요. 목록에서 다시 고르세요.',
  PROGRAM_NOT_FOUND: () => `프로그램 정보를 찾을 수 없어요. ${askHelp()}.`,
  FILE_NOT_FOUND: () => '파일을 찾을 수 없어요. 지워졌을 수 있어요.',

  // 상태가 바뀜
  VERSION_CONFLICT: () => `다른 화면에서 먼저 바뀌었어요. ${REFRESH}`,
  ALREADY_SUBMITTED: () => `이미 제출한 요청이에요. ${REFRESH}`,
  SUBMISSION_LOCKED: () => `제출했거나 마감돼서 고칠 수 없어요. ${REFRESH}`,
  NOT_IN_REVISION: () => `보완 요청을 받은 상태가 아니에요. ${REFRESH}`,
  FIELD_NOT_EDITABLE: () => '보완 요청을 받은 항목만 고칠 수 있어요. 새로고침한 뒤 그 항목만 고치세요.',
  DEADLINE_PASSED: () => '마감이 지났어요. 담당자에게 기한 연장을 요청하세요.',
  SUBMISSION_NOT_REVIEWABLE: () => `제출 상태가 바뀌어 검토할 수 없어요. ${REFRESH}`,
  REQUEST_NOT_EDITABLE: () => '이미 공개된 요청이라 고칠 수 없어요.',

  // 파일
  FILE_LOCKED: () => `지금은 이 항목의 파일을 바꿀 수 없어요. ${REFRESH}`,
  INVALID_EXTENSION: () => '올릴 수 없는 파일 형식이에요. 항목 아래 안내된 형식으로 올리세요.',
  FILE_TOO_LARGE: () => '파일이 허용 용량보다 커요. 용량을 줄여서 올리세요.',
  FILE_COUNT_EXCEEDED: () => '더 올릴 수 없어요. 올린 파일을 지운 뒤 올리세요.',
  FILE_MISMATCH: () => '올린 파일을 확인하지 못했어요. 다시 올리세요.',
  UPLOAD_NOT_FOUND: () => '올린 파일을 확인하지 못했어요. 다시 올리세요.',
}

export function errorCode(err: unknown) {
  if (err instanceof ApiError) return err.status >= 500 && !TEXT[err.code] ? 'INTERNAL_SERVER_ERROR' : err.code
  // fetch 자체가 실패하면 TypeError가 온다(연결 끊김, 차단)
  return 'NETWORK_ERROR'
}

// 오류를 "왜 안 됐는지 + 할 일" 한두 문장으로
export function errorText(err: unknown) {
  const text = TEXT[errorCode(err)]
  return text ? text() : `처리하지 못했어요. 다시 해도 안 되면 ${askHelp()}.`
}
