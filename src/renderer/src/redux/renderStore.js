import { configureStore } from '@reduxjs/toolkit'
import renderReducer from './renderSlice'

export default configureStore({
    reducer: { render: renderReducer }
})
