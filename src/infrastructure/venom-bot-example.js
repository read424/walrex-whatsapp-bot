const venom = require('venom-bot');
const fs = require('fs');

venom
  .create({
    session: 'session-name' //name of session
  })
  .then((client) => start(client))
  .catch((erro) => {
    console.log(erro);
  });

  process.on('SIGINT', function() {
    client.close();
  });

function start(client) {
  client.onMessage((message) => {
    if (message.isGroupMsg === false) {
      switch(message.body){
        case 'Hi':
          client
            .sendText(message.from, 'Welcome Venom 🕷')
            .then((result) => {
              console.log('Result: ', result); //return object success
            })
            .catch((erro) => {
              console.error('Error when sending: ', erro); //return object error
            });
            break;
        case 'poll':
          message_poll(client);
          break;
        case 'list':
          message_list(client);
          break;
        case 'button':
          message_button(client);
          break;
        case 'mp3':
          send_message_mp3(client);
          break;
        case 'file_base64':
          send_file_base64(client);
          break;
        case 'contact':
          send_contact(client);
          break;
        case 'list_contacts':
          send_list_contacts(client);
          break;
        case 'location':
          send_location(client);
          break;
        case 'message_option':
          send_message_option(client);
          break;
        case 'seen':
          send_seen(client);
          break;
      }
    }
  });
}

async function message_poll(client){
  const poll = {
    name: 'new poll',
    options: [
      {
        name: 'option 1'
      },
      {
        name: 'option 2'
      }
    ],
    selectableOptionsCount: 1
  };
  await client.sendPollCreation('51935926562@c.us', poll)
          .then((result) => {
            console.log('Result: ', result); //return object success
          })
          .catch((erro) => {
            console.error('Error when sending: ', erro); //return object error
          });  
}

async function message_list(client){
  // Send List menu
  const list = [
    {
      title: "Pasta",
      rows: [
        {
          title: "Ravioli Lasagna",
          description: "Made with layers of frozen cheese",
        }
      ]
    },
    {
      title: "Dessert",
      rows: [
        {
          title: "Baked Ricotta Cake",
          description: "Sweets pecan baklava rolls",
        },
        {
          title: "Lemon Meringue Pie",
          description: "Pastry filled with lemonand meringue.",
        }
      ]
    }
  ];

  await client.sendListMenu('51935926562@c.us', 'Title', 'subTitle', 'Description', 'menu', list)
  .then((result) => {
    console.log('Result: ', result); //return object success
  })
  .catch((erro) => {
    console.error('Error when sending: ', erro); //return object error
  });  
}

async function message_button(client){
  // Send Messages with Buttons Reply
  const buttons = [
  {
    "buttonText": {
      "displayText": "Text of Button 1"
      }
    },
  {
    "buttonText": {
      "displayText": "Text of Button 2"
      }
    }
  ]
  await client.sendButtons('51935926562@c.us', 'Title', 'Description', buttons)
  .then((result) => {
    console.log('Result: ', result); //return object success
  })
  .catch((erro) => {
    console.error('Error when sending: ', erro); //return object error
  });  
}

async function send_message_mp3(client){
  // Send audio file MP3
  await client.sendVoice('51935926562@c.us', './test_file.mp3').then((result) => {
    console.log('Result: ', result); //return object success
  })
  .catch((erro) => {
    console.error('Error when sending: ', erro); //return object error
  });  
}

async function send_file_base64(client){
  const base64MP3 = await getBase64FromFile('./test_file.mp3');
  // Send audio file base64
  await client.sendVoiceBase64('51935926562@c.us', base64MP3)
  .then((result) => {
    console.log('Result: ', result); //return object success
  })
  .catch((erro) => {
    console.error('Error when sending: ', erro); //return object error
  });  
}

async function send_contact(client){
  // Send contact
  await client
    .sendContactVcard('51935926562@c.us', '51980776018@c.us', 'Lusbey Sanchez')
    .then((result) => {
      console.log('Result: ', result); //return object success
    })
    .catch((erro) => {
      console.error('Error when sending: ', erro); //return object error
    });  
}

async function send_list_contacts(client){
  // Send a list of contact cards
  await client
  .sendContactVcardList('51935926562@c.us', [
    '111111111111@c.us',
    '222222222222@c.us',
  ])
  .then((result) => {
    console.log('Result: ', result); //return object success
  })
  .catch((erro) => {
    console.error('Error when sending: ', erro); //return object error
  });  
}

async function send_location(client){
  // Send location
  await client
    .sendLocation('51935926562@c.us', '-13.6561589', '-69.7309264', 'Brasil')
    .then((result) => {
      console.log('Result: ', result); //return object success
    })
    .catch((erro) => {
      console.error('Error when sending: ', erro); //return object error
    });
}

async function send_message_option(client){
  // Send message with options
  await client
    .sendMessageOptions(
      '51935926562@c.us',
      'This is a reply!',
        {
          quotedMessageId: reply,
      }
    )
    .then((retorno) => {
      resp = retorno;
    })
    .catch((e) => {
      console.log(e);
    });
}

async function send_seen(client){
  // Send seen ✔️✔️
  await client.sendSeen('51935926562@c.us');
}

function getBase64FromFile(filePath){
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, { encoding: 'base64' }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const base64 = data.toString('base64');
        resolve(base64);
      }
    });
  })
}