const { assign } = require('xstate');
const { pgrService } = require('./service/service-loader');
const dialog = require('./util/dialog');

const pgr =  {
  id: 'pgr',
  initial: 'menu',
  states: {
    menu : {
      id: 'menu',
      initial: 'question',
      states: {
        question: {
          onEntry: assign( (context, event) => {
              context.chatInterface.toUser(context.user, dialog.get_message(messages.menu.question, context.user.locale));
          }),
          on: {
              USER_MESSAGE:'process'
          }
        }, // menu.question
        process: {
          onEntry: assign((context, event) => context.intention = dialog.get_intention(grammer.menu.question, event)),
          always : [
            {
              target: '#fileComplaint',
              cond: (context) => context.intention == 'file_new_complaint'
            },
            {
              target: '#trackComplaint', 
              cond: (context) => context.intention == 'track_existing_complaints'
            },
            {
              target: 'error'
            }
          ]
        }, // menu.process
        error: {
          onEntry: assign( (context, event) => context.chatInterface.toUser(context.user, dialog.get_message(dialog.global_messages.error.retry, context.user.locale))),
          always : 'question'
        } // menu.error
      }, // menu.states
    }, // menu
    fileComplaint: {
      id: 'fileComplaint',
      initial: 'complaintType',
      states: {
        complaintType: {
          id: 'complaintType',
          initial: 'question',
          states: {
            question: {
              invoke: {
                src: (context) => pgrService.fetchFrequentComplaints(),
                id: 'fetchFrequentComplaints',
                onDone: {
                  actions: assign((context, event) => {
                    let preamble = dialog.get_message(messages.fileComplaint.complaintType.question.preamble, context.user.locale);
                    let {complaintTypes, messageBundle} = event.data;
                    let {prompt, grammer} = dialog.constructListPromptAndGrammer(complaintTypes, messageBundle, context.user.locale, true);
                    context.grammer = grammer; // save the grammer in context to be used in next step
                    context.chatInterface.toUser(context.user, `${preamble}${prompt}`);
                  }) 
                },
                onError: {
                  target: '#system_error'
                }
              },
              on: {
                USER_MESSAGE: 'process'
              }
            }, //question
            process: {
              onEntry: assign((context, event) => {
                context.intention = dialog.get_intention(context.grammer, event) 
              }),
              always: [
                {
                  target: '#complaintType2Step',
                  cond: (context) => context.intention == dialog.INTENTION_MORE
                },
                {
                  target: '#geoLocationSharingInfo',
                  cond: (context) => context.intention != dialog.INTENTION_UNKOWN,
                  actions: assign((context, event) => {
                    context.slots.pgr["complaint"]= context.intention;
                  })
                },
                {
                  target: 'error'
                }
              ]
            }, // process
            error: {
              onEntry: assign( (context, event) => {
                context.chatInterface.toUser(context.user, dialog.get_message(dialog.global_messages.error.retry, context.user.locale));
              }),
              always: 'question',
            } // error
          } // states of complaintType
        }, // complaintType
        complaintType2Step: {
          id: 'complaintType2Step',
          initial: 'complaintCategory',
          states: {
            complaintCategory: {
              id: 'complaintCategory',
              initial: 'question',
              states: {
                question: {
                  invoke:  {                  
                    src: (context, event)=>pgrService.fetchComplaintCategories(),
                    id: 'fetchComplaintCategories',
                    onDone: {
                      actions: assign((context, event) => {
                        let { complaintCategories, messageBundle } = event.data;
                        let preamble = dialog.get_message(messages.fileComplaint.complaintType2Step.category.question.preamble, context.user.locale);
                        let {prompt, grammer} = dialog.constructListPromptAndGrammer(complaintCategories, messageBundle, context.user.locale);
                        context.grammer = grammer; // save the grammer in context to be used in next step
                        context.chatInterface.toUser(context.user, `${preamble}${prompt}`);
                      }),
                    }, 
                    onError: {
                      target: '#system_error'
                    }
                  },
                  on: {
                    USER_MESSAGE: 'process'
                  }
                }, //question
                process: {
                  onEntry: assign((context, event) => {
                    context.intention = dialog.get_intention(context.grammer, event, true) 
                  }),
                  always: [
                    {
                      target: '#complaintItem',
                      cond: (context) => context.intention != dialog.INTENTION_UNKOWN
                    },
                    {
                      target: 'error'
                    }
                  ]
                }, // process
                error: {
                  onEntry: assign( (context, event) => {
                    context.chatInterface.toUser(context.user, dialog.get_message(dialog.global_messages.error.retry, context.user.locale));
                  }),
                  always:  'question',
                } // error
              } // states of complaintCategory
            }, // complaintCategory
            complaintItem: {
              id: 'complaintItem',
              initial: 'question',
              states: {
                question: {
                  invoke:  {                  
                    src: (context) => pgrService.fetchComplaintItemsForCategory(context.intention),
                    id: 'fetchComplaintItemsForCategory',
                    onDone: {
                      actions: assign((context, event) => {
                        let { complaintItems, messageBundle } = event.data;
                        let preamble = dialog.get_message(messages.fileComplaint.complaintType2Step.item.question.preamble, context.user.locale);
                        let {prompt, grammer} = dialog.constructListPromptAndGrammer(complaintItems, messageBundle, context.user.locale, false, true);
                        context.grammer = grammer; // save the grammer in context to be used in next step
                        context.chatInterface.toUser(context.user, `${preamble}${prompt}`);
                      })
                    }, 
                    onError: {
                      target: '#system_error'
                    }
                  },
                  on: {
                    USER_MESSAGE: 'process'
                  }
                }, //question
                process: {
                  onEntry: assign((context, event) => {
                    context.intention = dialog.get_intention(context.grammer, event) 
                  }),
                  always: [
                    {
                      target: '#complaintCategory',
                      cond: (context) => context.intention == dialog.INTENTION_GOBACK
                    },
                    {
                      target: '#geoLocationSharingInfo',
                      cond: (context) => context.intention != dialog.INTENTION_UNKOWN,
                      actions: assign((context, event) => {
                        context.slots.pgr["complaint"]= context.intention;
                      })
                    },
                    {
                      target: 'error'
                    }
                  ]
                }, // process
                error: {
                  onEntry: assign( (context, event) => {
                    context.chatInterface.toUser(context.user, dialog.get_message(dialog.global_messages.error.retry, context.user.locale));
                  }),
                  always:  'question',
                } // error
              } // states of complaintItem
            }, // complaintItem
          } // states of complaintType2Step
        }, // complaintType2Step
        geoLocationSharingInfo: {
          id: 'geoLocationSharingInfo',
          onEntry: assign( (context, event) => {
            context.chatInterface.toUser(context.user, '_Informational Image_');
          }),
          always: 'geoLocation'
        },
        geoLocation: {
          id: 'geoLocation',
          initial: 'question',
          states : {
            question: {
              onEntry: assign( (context, event) => {
                let message = dialog.get_message(messages.fileComplaint.geoLocation.question, context.user.locale)
                context.chatInterface.toUser(context.user, message);
              }),
              on: {
                USER_MESSAGE: 'process'
              }
            },
            process: {
              invoke: {
                id: 'getCityAndLocality',
                src: (context, event) => {
                  if(event.message.type === 'location') {
                    context.slots.pgr.geocode = event.message.input;
                    return pgrService.getCityAndLocalityForGeocode(event.message.input);
                  }
                  return Promise.resolve({});
                },
                onDone: [
                  {
                    target: '#confirmLocation',
                    cond: (context, event) => event.data.city,
                    actions: assign((context, event) => {
                      context.slots.pgr["city"]= event.data.city;
                      context.slots.pgr["locality"] = event.data.locality;
                    })
                  },
                  {
                    target: '#city',
                    actions: assign((context, event) => {
                      console.log('qwe');
                    })
                  }
                ],
                onError: {
                  target: '#city',
                  actions: assign((context, event) => {
                    let message = dialog.get_message(dialog.global_messages.system_error, context.user.locale);
                    context.chatInterface.toUser(context.user, message); // TODO - Rushang - message should say, "we are going to try different approach"
                  })
                }
              }
            }
          }
        },
        confirmLocation: {
          id: 'confirmLocation',
          initial: 'question',
          states: {
            question: {
              onEntry: assign((context, event) => {
                // TODO - Rushang clean this?
                var message = 'Is this the correct location of the complaint?';
                message += '\nCity: ' + context.slots.pgr["city"];
                message += '\nLocality: ' + context.slots.pgr["locality"];
                message += '\nPlease send \'No\', if it isn\'t correct'
                context.chatInterface.toUser(context.user, message);
              }),
              on: {
                USER_MESSAGE: 'process'
              }
            },
            process: {
              onEntry: assign((context, event) => {
                if(event.message.input.trim().toLowerCase() === 'no') {
                  context.slots.pgr["locationConfirmed"] = false;
                } else {
                  context.slots.pgr["locationConfirmed"] = true;
                }
              }),
              always: [
                {
                  target: '#persistComplaint',
                  cond: (context, event) => context.slots.pgr["locationConfirmed"]  && context.slots.pgr["locality"]
                },
                {
                  target: '#locality',
                  cond: (context, event) => context.slots.pgr["locationConfirmed"] 
                },
                {
                  target: '#city'
                }
              ]
            }
          }
        },
        city: {
          id: 'city',
          initial: 'question',
          states: {
            question: {
              invoke: {
                id: 'fetchCities',
                src: (context, event) => pgrService.fetchCities(),
                onDone: {
                  actions: assign((context, event) => {
                    let { cities, messageBundle } = event.data;
                    let preamble = dialog.get_message(messages.fileComplaint.city.question.preamble, context.user.locale);
                    let link = pgrService.getCityExternalWebpageLink();
                    let message = preamble + '\n' + link;
                    context.grammer = dialog.constructLiteralGrammer(cities, messageBundle, context.user.locale);
                    context.chatInterface.toUser(context.user, message);
                  })
                },
                onError: {
                  target: '#system_error'
                }
              },
              on: {
                USER_MESSAGE: 'process'
              }
            },
            process: {
              onEntry:  assign((context, event) => {
                context.intention = dialog.get_intention(context.grammer, event) 
              }),
              always : [
                {
                  target: '#locality',
                  cond: (context) => context.intention != dialog.INTENTION_UNKOWN,
                  actions: assign((context, event) => context.slots.pgr["city"] = context.intention)    
                },
                {
                  target: 'error',
                }, 
              ]
            },
            error: {
              onEntry: assign( (context, event) => {
                context.chatInterface.toUser(context.user, dialog.get_message(dialog.global_messages.error.retry, context.user.locale));
              }),
              always:  'question',
            }
          }
        },
        locality: {
          id: 'locality',
          initial: 'question',
          states: {
            question: {
              invoke: {
                id: 'fetchLocalities',
                src: (context) => pgrService.fetchLocalities(context.slots.pgr.city),
                onDone: {
                  actions: assign((context, event) => {
                    let { localities, messageBundle } = event.data;
                    let preamble = dialog.get_message(messages.fileComplaint.locality.question.preamble, context.user.locale);
                    let link = pgrService.getLocalityExternalWebpageLink(context.slots.pgr.city);
                    let message = preamble + '\n' + link;
                    context.grammer = dialog.constructLiteralGrammer(localities, messageBundle, context.user.locale);
                    context.chatInterface.toUser(context.user, message);
                  })
                }
              },
              on: {
                USER_MESSAGE: 'process'
              }
            },
            process: {
              onEntry:  assign((context, event) => {
                context.intention = dialog.get_intention(context.grammer, event) 
              }),
              always : [
                {
                  target: '#persistComplaint',
                  cond: (context) => context.intention != dialog.INTENTION_UNKOWN,
                  actions: assign((context, event) => context.slots.pgr["locality"] = context.intention)
                },
                {
                  target: 'error',
                }, 
              ]
            },
            error: {
              onEntry: assign( (context, event) => {
                context.chatInterface.toUser(context.user, dialog.get_message(dialog.global_messages.error.retry, context.user.locale));
              }),
              always:  'question',
            }
          }
        },
        persistComplaint: {
          id: 'persistComplaint',
          invoke: {
            id: 'persistComplaint',
            src: (context) => pgrService.persistComplaint(context.slots.pgr),
            onDone: {
              target: '#endstate',
              actions: assign((context, event) => {
                let complaintDetails = event.data;
                let message = dialog.get_message(messages.fileComplaint.persistComplaint, context.user.locale);
                message = message.replace('{{complaintNumber}}', complaintDetails.complaintNumber);
                message = message.replace('{{complaintLink}}', complaintDetails.complaintLink);
                context.chatInterface.toUser(context.user, message);
              })
            }
          }
        },
      }, // fileComplaint.states
    },  // fileComplaint
    trackComplaint: {
      id: 'trackComplaint',
      invoke: {
        id: 'fetchOpenComplaints',
        src: (context) => pgrService.fetchOpenComplaints(context.user),
        onDone: [
          {
            target: '#endstate',
            cond: (context, event) => event.data.length > 0,
            actions: assign((context, event) => {
              let complaints = event.data;
              let message = dialog.get_message(messages.trackComplaint.results.preamble, context.user.locale);
              message += '\n';
              for(let i = 0; i < complaints.length; i++) {
                let template = dialog.get_message(messages.trackComplaint.results.complaintTemplate, context.user.locale);
                template = template.replace('{{complaintType}}', complaints[i].complaintType);
                template = template.replace('{{complaintId}}', complaints[i].complaintId);
                template = template.replace('{{filedDate}}', complaints[i].filedDate);
                template = template.replace('{{complaintStatus}}', complaints[i].complaintStatus);
                template = template.replace('{{complaintLink}}', complaints[i].complaintLink);
                message += '\n' + (i + 1) + '. ' + template;
              }

              context.chatInterface.toUser(context.user, message);
            })
          },
          {
            target: '#endstate',
            actions: assign((context, event) => {
              let message = dialog.get_message(messages.trackComplaint.noRecords, context.user.locale);
              context.chatInterface.toUser(context.user, message);
            })
          }
        ]
      }
    } // trackComplaint
  } // pgr.states
}; // pgr

let messages = {
  menu: {
    question: {
      en_IN : 'Please type\n\n1 to File New Complaint.\n2 to Track Your Complaints',
      hi_IN: 'कृप्या टाइप करे\n\n1 यदि आप शिकायत दर्ज करना चाहते हैं\n2 यदि आप अपनी शिकायतों की स्थिति देखना चाहते हैं'
    }
  },
  fileComplaint: {
    complaintType: {
      question: {
        preamble: {
          en_IN : 'Please enter the number for your complaint',
          hi_IN : 'कृपया अपनी शिकायत के लिए नंबर दर्ज करें'
        },
        other: {
          en_IN : 'Other ...',
          hi_IN : 'कुछ अन्य ...'
        }
      }
    }, // complaintType
    complaintType2Step: {
      category: {
        question: {
          preamble: {
            en_IN : 'Please enter the number for your complaint category',
            hi_IN : 'अपनी शिकायत श्रेणी के लिए नंबर दर्ज करें'
          },
        }
      },
      item: {
        question: {
          preamble : {
            en_IN : 'Please enter the number for your complaint item',
            hi_IN : 'अपनी शिकायत के लिए नंबर दर्ज करें'
          },
        }
      },
    }, // complaintType2Step
    geoLocation: {
      question: {
        en_IN :'If you are at the grievance site, please share your location. Otherwise type any character.',
        hi_IN : 'यदि आप शिकायत स्थल पर हैं, तो कृपया अपना स्थान साझा करें। अगर नहीं किसी भी चरित्र को टाइप करें।'
      }
    }, // geoLocation 
    city: {
      question: {
        preamble: {
          en_IN: 'Please select your city from the link given below. Tap on the link to search and select your city.',
          hi_IN: 'कृपया नीचे दिए गए लिंक से अपने शहर का चयन करें। अपने शहर को खोजने और चुनने के लिए लिंक पर टैप करें।'
        }
      }
    }, // city
    locality: {
      question: {
        preamble: {
          en_IN: 'Please select the locality of your complaint from the link below. Tap on the link to search and select a locality.',
          hi_IN: 'कृपया नीचे दिए गए लिंक से अपनी शिकायत के इलाके का चयन करें। किसी इलाके को खोजने और चुनने के लिए लिंक पर टैप करें।'
        }
      }
    }, // locality
    persistComplaint: {
      en_IN: 'Thank You! You have successfully filed a complaint through mSeva Punjab.\nYour Complaint No is : {{complaintNumber}}\nYou can view and track your complaint  through the link below:\n{{complaintLink}}\n\nPlease type and send “mseva” whenever you need my assistance.'
    }
  }, // fileComplaint
  trackComplaint: {
    noRecords: {
      en_IN: 'There are no open complaints.\nPlease type and send mseva to go to the main menu options.'
    },
    results: {
      preamble: {
        en_IN: 'Your Open Complaints'
      },
      complaintTemplate: {
        en_IN: '*{{complaintType}}*\nComplaint No: {{complaintId}}\nFiled Date: {{filedDate}}\nCurrent Complaint Status: *{{complaintStatus}}*\nTap on the link below to view the complaint\n{{complaintLink}}'
      }
    }
  }
}; // messages

let grammer = {
  menu: {
    question: [
      {intention: 'file_new_complaint', recognize: ['1', 'file', 'new']},
      {intention: 'track_existing_complaints', recognize: ['2', 'track', 'existing']}
    ]
  },
};
module.exports = pgr;