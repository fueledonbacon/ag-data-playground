const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const controllers = require('./controllers')
const { get } = require('lodash')
const constants = require('./constants.json')
const moment = require('moment')
const utilities = require('./utilities')

const kc_value = (type, date, index = 0) => {
  const collection = get(constants, `kc.${type}[${index}].values`, [])
  const m = moment(date).month()
  const d = moment(date).date()
  let value = null
  for (const kc of collection) {
    const kcm = moment(kc.date).month()
    const kcd = moment(kc.date).date()
    if (kcm > m || (kcm == m && kcd >= d)) {
      break
    }
    value = Number(kc.value)
  }
  return value
}

module.exports = class Field {
  static async fetch(agrian_id) {
    const data = await prisma.field.findOne({ where: { agrian_id }, include: { water_events: true, et_values: true } })
    return data
  }

  static async listAll(water = false, eto = false) {
    const options = {
      include: {
        water_events: water,
        et_values: eto
      }
    } 
    const data = await prisma.field.findMany(options)
    return data
  }

  constructor(field, startDate, endDate) {
    Object.assign(this, field)
    this.startDate = startDate || this.start_date
    this.endDate = endDate || utilities.justDate(new Date())
    this.cache = new Map()
  }

  static async harvestEtoValues(field) {
    
    let startDate = moment().format('YYYY-MM-DD')
    do {
      let endDate = moment(startDate).subtract(1, 'day').format('YYYY-MM-DD')
      startDate = moment(endDate).subtract(30, 'days').format('YYYY-MM-DD')
      try {
        console.log(`month: ${moment(startDate).month()}, field: ${field.agrian_id}`)
        const eto_values = await new Field(field, startDate, endDate).eto()
        for (const eto of eto_values) {
          const date = moment(eto.date).format('YYYY-MM-DD')
          await prisma.eTValue.upsert({
            where: {
              key: `${field.agrian_id}:${date}`
            },
            update: {
              value: Number(eto.value)
            },
            create: {
              key: `${field.agrian_id}:${date}`,
              date: new Date(date),
              value: Number(eto.value),
              field: {
                connect: {
                  agrian_id: field.agrian_id
                }
              }
            }
          })
        }
      } catch (e) {
        console.log(e)
      }
      await utilities.timeout(2000)
    } while (moment(startDate).month() > 1)

    return 'OK'
  }

  irrigation_rate_in_hr() {
    return 96.3 / 43560 * this.avg_gpm / this.area
  }
  mad() {
    return -1 * this.soil_holding_capacity * this.mad_percent
  }
  irrigation_efficiency() {
    return this.du * (1 - this.pre_infiltration_losses)
  }
  async eto() {
    let data = get(this, 'et_values', [])
    if (!(this.startDate && this.endDate)) 
      return []

    let start = new Date(this.startDate).getTime()
    let end = new Date(this.endDate).getTime()
    data.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    data = data.filter(et => {
      const etDate = new Date(et.date).getTime()
      return etDate >= start && etDate <= end
    })
    //   data = await controllers.eto(null, this)
    this.cache.set("eto_values", data)
    // }
    return data
  }
  async etc() {
    if (this.cache.has("etc_values"))
      return this.cache.get("etc_values")
    let eto_arr = (this.cache.has("eto_values")) ? this.cache.get("eto_values") : await this.eto()

    let data = new Array(eto_arr.length)
    for (const [i, { date, value: eto }] of eto_arr.entries()) {
      let record = { date }
      const kc = kc_value(this.kc_type, date)
      record.value = Number(eto) * kc * this.canopy_cover_percent
      data[i] = record
    }
    this.cache.set("etc_values", data)
    return data
  }
  async smb() {
    const etc_values = (this.cache.has("etc_values")) ? this.cache.get("etc_values") : await this.etc()
    let events = new Map()
    for (const e of this.water_events) {
      events.set(utilities.justDate(e.date), e)
    }
    let result = [{ date: null, value: 0 }]
    for (const [i, { date, value }] of etc_values.entries()) {
      let adjustment = 0
      if (events.has(date)) {
        const { duration_hours } = events.get(date)
        adjustment = duration_hours * this.irrigation_rate_in_hr() * this.irrigation_efficiency()
      }
      let record = {
        date,
        value: Math.min(Number(result[i].value) - Number(value) + adjustment, 0)
      }
      result.push(record)
    }
    return result
  }
}
