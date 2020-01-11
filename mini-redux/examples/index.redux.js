const ADD_GUN = '买房'
const REMOVE_GUN = '卖房'

// 通过reducer建立store（reducer会根据老的state和action，生成新的state）
export function counter(state = 0, action) {
  switch (action.type) {
    case '买房':
      return state + 1
    case '卖房':
      return state - 1
    default:
      return 10
  }
}

// action creator
export function addGun() {
  return { type: ADD_GUN }
}

export function removeGun() {
  return { type: REMOVE_GUN }
}

export function addGunAsync() {
  return dispatch => {
    setTimeout(() => {
      dispatch(addGun())
    }, 2000)
  }
}

export function addTwice() {
  return [addGun(), addGunAsync()]
}
