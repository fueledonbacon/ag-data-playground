import Vue from 'vue'
import VueRouter from 'vue-router'
import Fields from '../components/Fields'
import WaterEvents from '../components/WaterEvents'
import SoilMoistureBalance from '../components/SoilMoistureBalance';

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'SoilMoistureBalance',
    component: SoilMoistureBalance
  },
  {
    path: '/fields',
    name: 'Edit Fields',
    component: Fields
  },
  {
    path: '/water-events',
    name: 'Water Events',
    component: WaterEvents
  },
]

const router = new VueRouter({
  routes
})

export default router
