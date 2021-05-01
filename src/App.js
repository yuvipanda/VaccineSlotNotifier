import React, { useEffect, useState } from 'react';
import {
  ChakraProvider,
  Text,
  VStack,
  theme,
  Flex,
  Select,
  Table,
  Tr,
  Td,
  Container,
  Thead,
  Tbody,
  Box,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { ColorModeSwitcher } from './ColorModeSwitcher';
import axios from 'axios';
import { DateTime } from 'luxon'

const getStates = async () => {
  const url = 'https://api.cowin.gov.in/api/v2/admin/location/states';
  const states = (await axios.get(url)).data.states
  return states;
}

const getDistricts = async (state_id) => {
  const distUrl = `https://api.cowin.gov.in/api/v2/admin/location/districts/${state_id}`;
  const districts = (await axios.get(distUrl)).data.districts
  return districts;
}

const getCenters = async (district_id) => {
  const url = 'https://api.cowin.gov.in/api/v2/appointment/sessions/calendarByDistrict'
  const params = {
    district_id: district_id,
    date: DateTime.now().setZone('Asia/Kolkata').plus({ days: 1 }).toFormat('dd-MM-yyyy')
  }
  let resp;
  try {
    resp = await axios.get(url, { params: params })
  } catch (e) {
    if (e.response.status !== 200) {
      console.log(`Got response ${e.response.status} for ${district_id}`)
      return []
    }
    throw e;
  }
  const data = resp.data
  return data.centers;
}

const updateCenters = async (districtId, setCenters, setLastUpdated, setIsLoading) => {
  setIsLoading(true)
  console.log(`Updating centers for ${districtId}`)
  setCenters(await getCenters(districtId))
  setIsLoading(false)
  setLastUpdated(DateTime.now())
}

const DistrictSelector = ({ setCenters, isLoading, setIsLoading, setLastUpdated, setDistrictId, ...props }) => {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    (async () => {
      setStates(await getStates())
    })()
  }, [])

  return <Flex {...props}>
    <Select placeholder="Select State" onChange={(ev) => {
      setDistrictId(null)
      setIsLoading(true);
      (async () => {
        setDistricts(await getDistricts(ev.target.value))
        setIsLoading(false)
      })();
    }}>
      {states.map(state => {
        return <option key={state.state_id} value={state.state_id}>{state.state_name}</option>
      })}
    </Select>
    <Select isDisabled={districts === []} placeholder="Select district"
      onChange={(ev) => {
        setDistrictId(ev.target.value);
        (async () => {
          await updateCenters(ev.target.value, setCenters, setLastUpdated, setIsLoading)
        })()
      }} >
      {districts.map(district => {
        return <option key={district.district_id} value={district.district_id}>{district.district_name}</option>
      })}
    </Select>

  </Flex >
}

const Centers = ({ districtId, centers, setCenters, setIsLoading, setLastUpdated }) => {

  useEffect(() => {
    const handle = setInterval(() => {
      if (districtId === null) {
        console.log(1)
      } else {
        (async () => {
          updateCenters(districtId, setCenters, setLastUpdated, setIsLoading)
        })();
        console.log(2)
      }
    }, 60 * 1000)
    return () => {
      console.log(5)
      clearInterval(handle)
    }
  }, [])


  // Dates are always today + 7
  // FIXME
  let dates = []
  for (let i = 0; i < 7; i++) {
    dates.push(DateTime.now().setZone('Asia/Kolkata').plus({ days: i }));
  }
  let availableCenters = centers.filter(c => {
    return c.sessions.some(s => s.min_age_limit < 45)
  }).map(center => {
    const sessionsByDate = center.sessions.reduce((map, session) => {
      map[session.date] = session;
      return map;
    }, {})
    return {
      ...center,
      sessionsByDate: sessionsByDate
    }
  })

  if (availableCenters.length === 0) {
    return <Center>
      <Text>No slots available for 18+ persons in this district</Text>
    </Center>
  }

  return <Table size="sm">
    <Thead>
      <Tr>
        <Td>Locality</Td>
        <Td>Name</Td>
        <Td>PIN</Td>
        {dates.map(d => <Td key={d}>{d.toFormat("dd MMM")}</Td>)}
      </Tr>
    </Thead >
    <Tbody>
      {availableCenters.map(c => {
        return < Tr key={c.center_id} >
          <Td>{c.block_name}</Td>
          <Td>{c.name}</Td>
          <Td>{c.pincode}</Td>
          {
            dates.map(d => {
              const formattedDate = d.toFormat('dd-MM-yyyy');
              if (c.sessionsByDate[formattedDate]) {
                const slots = c.sessionsByDate[formattedDate].available_capacity;
                return <Td backgroundColor={slots != 0 && "green.200"} isNumeric key={d}>{slots}</Td>
              }
            })
          }
        </Tr>
      })}
    </Tbody>
  </Table >

}

function App() {
  const [centers, setCenters] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [districtId, setDistrictId] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Gets the compiler off my back
  console.log(lastUpdated)

  return (
    <ChakraProvider theme={theme}>
      <Container maxW="container.lg">
        <VStack spacing={8}>
          <ColorModeSwitcher />
          <Box width="100%">

            <DistrictSelector
              flexGrow={1}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              setCenters={setCenters}
              setDistrictId={setDistrictId}
              setLastUpdated={setLastUpdated}
              setIsLoading={setIsLoading} />
            <Flex height={1}>
              {isLoading && "Updating..."}
            </Flex>
          </Box>
          {districtId !== null ?
            <Centers centers={centers} districtId={districtId} setCenters={setCenters} setIsLoading={setIsLoading} setLastUpdated={setLastUpdated} /> :
            <Center>
              <Text>Please select a state and district</Text>
            </Center>

          }
        </VStack>
      </Container>
    </ChakraProvider >
  );
}

export default App;
