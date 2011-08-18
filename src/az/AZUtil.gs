package az
uses gw.RemoteIssue
uses org.apache.commons.httpclient.HttpClient
uses org.apache.commons.httpclient.methods.PostMethod
uses org.apache.commons.httpclient.methods.GetMethod
uses org.apache.commons.httpclient.methods.PutMethod
uses org.apache.commons.httpclient.methods.DeleteMethod
uses java.math.BigInteger
uses java.util.HashMap
uses xsds.agilezenstories.Story
uses xsds.agilezenstories.Stories
//uses com.guidewire.util.Throw
uses xsds.agilezenstory.types.complex.User
uses xsds.agilezenroles.Roles
uses xsds.agilezenroles.types.complex.Role
uses java.util.Date
uses java.util.TimeZone
uses java.util.Map
uses xsds.agilezenroles.enums.Color

class AZUtil {
  
  var _project : String as Project
  var _apikey : String as ApiKey
  var httpClient = new HttpClient()
  var _usermap  = new HashMap<String, BigInteger>()
  var _newCount : int as NewCount = 0
  var _updateCount : int as UpdateCount = 0
  var _deleteCount : int as DeleteCount = 0
  static var _UnassignedUser = "plintegration"
  static var _nullUser = "null"
  static var _JiraStatusOpen = 1
  static var _JiraStatusClosed = 6
  
  
    
  public function getAZStories() : HashMap<String, Story> {
    var storymap = new HashMap<String, Story>()
    var url = "https://agilezen.com/api/v1/projects/${_project}/stories?with=everything&pagesize=1000&apikey=${_apikey}"
    var getMethod = new GetMethod(url)
    getMethod.addRequestHeader( "Content-Type", "application/xml" )
  
    var respcode =  httpClient.executeMethod( getMethod )
//    print ("Response code: " + respcode)
    if (respcode != 200) Throw "HTTP : ${respcode} accessing AgileZen site at ${url} "    
    
    var resp =   getMethod.ResponseBody
  //  print ("Status text: " + getMethod.StatusText)
  //  print ("Status code: " + getMethod.StatusCode)
  //  print ("Response: " + getMethod.ResponseBodyAsString)
    var stories = Stories.parse( resp )
    stories.Items.Story.each( \ s -> {
//      print ("AZ Story Text: " + s.Text)
      var rightbracket = s.Text.indexOf( "]" )
      if (rightbracket >0) {
        var jiranum = s.Text.substring( 1 , rightbracket)
//      print("Jira: ${jiranum}")
     // s.print()
        storymap.put( jiranum,  s )
      }
    })
    print ("AZ Map has ${storymap.Count} entries")
    MapUsers(storymap)
    return storymap
  }  
  
  function getAZStory(jira: RemoteIssue, azMap : HashMap<String, Story>) : Story {
   return azMap.get( jira.Key )
  }
  
  public function pushNewStoryToAZ (jira : RemoteIssue) {

    print ("Creating new story in AZ: " + jira.Key)
    var postMethod = new PostMethod( "https://agilezen.com/api/v1/projects/${_project}/stories?apikey=${_apikey}")
    postMethod.addRequestHeader("Content-Type", "application/xml")
    
    var st = new xsds.agilezenstories.Story()
    st = setBaseFields( jira, _usermap, st )
   // st.Text = "[${jira.Key}](http://jira/jira/browse/${jira.Key}) : ${jira.Summary}"
    //if (getJiraEstimate(jira) != null)  st.Size = getJiraEstimate( jira )
    //print ("Jira status : ${jira.Status} ")
    st.Phase.Id = getjiraStatusInAZTerms( jira)
//    if (jira.Assignee.equals(_UnassignedUser)) {
//        st.Owner.Id = null
//        st.Owner.UserName = null
//        st.Owner.Email = null
//        if (st.Phase?.Name?.equals( "QA")){
//            st.BlockedReason="Ready for QA"
//            st.Status=Blocked
//        }
//    }
    var subs = getSubStories(jira)
//    st.Owner.Id = _usermap.get( jira.Assignee )
//    st.Priority = jirapriority.getValueByName( jira.Priority )
    _newCount++
    
   // st.print()    
    postMethod.setRequestBody(st.asUTFString())
    httpClient.executeMethod( postMethod )
    postMethod.releaseConnection()
    
    
  }
  
  public function updateAZStory2 (jira: RemoteIssue, story: Story) {

    var jiraStatus = jira.Status
    var jiraQAStatus = getJiraQAStatus( jira )
    var oldAZPhase = story.Phase.Name
    var need_to_send = needtoUpdateAZ2( jira, story )
    var st = cleancopy(story) // make a clean copy of the old story to start with
    
    
    st = setBaseFields(jira, _usermap, st)  // update all the base fields on the storycard
    while(need_to_send){
     // print ("AZ story ${story.Id}: " + jira.Key)
      if(jira.isOpen()){
        if (story.isOpen()){
          // print ("AZUtil: No Change")
          // I used to not send things here, but taking ownership of things didn't populate down to AZ.
          //    Therefore, it is better to send a lot of unneeded updates, than to 
          // need_to_send = false
          break  //Don't need to do anything to keep the Phase, it's there in the cleancopy()
        } else {
          print ("AZUtil: re-opening AZ story ${story.Id}: ${jira.Key}")
          st.reopen()
          break
        }
      }
    
      if(jira.isClosed() ){
          print ("AZUtil: Closing AZ story ${story.Id}: ${jira.Key}")
        st.close()
        break
      }
    
      if (jira.isCheckedInAndQANotNeeded()) {
          print ("AZUtil: Closing v2 AZ story ${story.Id}: ${jira.Key}")
        st.close()
        break
      }
    
      if (jira.isCheckedInAndReadyForQA()) {
        if (story.isInQA()) {
          print ("AZUtil: No Change v2")
          // I also didn't used to update these, but it's safer to update, since the assigned user might change
          //need_to_send = false
          break // do nothing for stories already in QA or Ready_for_QA
        } else {
          print ("AZUtil: Ready for QA AZ story ${story.Id}: ${jira.Key}")
          st.setReadyForQA()  
          break
        }
      }
    
      if(jira.failedQA()) {
        print ("AZUtil: Failed QA, reopening v2 AZ story ${story.Id}: ${jira.Key}")
        st.reopen()  
        break
      }
      print ("None of the statuses match AZ story ${story.Id}: ${jira.Key}")
      break
    }
    if (need_to_send) {
      var putMethod = new PutMethod("https://agilezen.com/api/v1/projects/${_project}/stories/${story.Id}?apikey=${_apikey}")
      putMethod.addRequestHeader( "Content-Type", "application/xml" )
      
      putMethod.setRequestBody( st.asUTFString() )
      _updateCount++
      var res = httpClient.executeMethod( putMethod )
      if(res == 400){
        st.print()
        print("State is "+ httpClient.State + "result:" + putMethod.ResponseBodyAsString)
      }
      putMethod.releaseConnection()
    } 
  }

  
  public function deleteAZStory(story : Story) {
    print("Deleting of ${story.Id}")
    var deleteMethod = new DeleteMethod("https://agilezen.com/api/v1/projects/${_project}/stories/${story.Id}?apikey=${_apikey}")
    deleteMethod.addRequestHeader( "Content-Type", "application/xml" )
    httpClient.executeMethod( deleteMethod )
    deleteMethod.releaseConnection()   
    _deleteCount++
  }
  
  public function tagReleases(jiras : Map<java.lang.String, gw.RemoteIssue>, azStories : HashMap<java.lang.String, xsds.agilezenstories.Story>){
     
  }
  
  private function needtoUpdateAZ2 (jira: RemoteIssue, story: Story) : boolean   {
    if(jira.isOpen() || jira.isCheckedInAndReadyForQA()) {
      return true
    }
    if (story.isInQA() || story.isOpen()) {
      return true
    }
    
    return false 
  }
  
  
  private function AZStatusCloseMatch(jira: RemoteIssue, story: Story) : boolean {
     var res = false
     print ("In StatusCloseMatch ${jira.Status} vs ${story.Phase.Id}")
      if (jira.Status.equals( AgileZenPhaseToJiraStatus.getValueByName( story.Phase.Id as String ) )){
       print ("matched on AZP2JS")
       res = true 
      }
      
//      if (getJiraQAStatus(jira)?.equals( JiraQAStatusMapping?.getValueByName(story.Phase.Id as String ) )){
//        if (
//        print("matched on JiraQAStatusMapping")
//        res = true
//      }
    return res
  }
  
  private function getjiraStatusInAZTerms( jira : RemoteIssue) : BigInteger {
     return new BigInteger(JiraToAgileZenPhases.getValueByName( jira.Status ))
  }
  
  private function getJiraQAStatus(jira : RemoteIssue) : String {    
    return jira.CustomFieldValues.firstWhere( \ r -> r.CustomfieldId == "customfield_10480" )?.Values?[0]
  }
  
  
  private function getJiraScheduledFixVersion(jira : RemoteIssue) : String {
    print ("In getJiraScheduledFixVersion")
     jira.CustomFieldValues.each( \ r -> print ("${r?.CustomfieldId}: ${r?.Values?[0]} ") )
     return ""
  }
  
   private function MapUsers(storymap : HashMap<String, Story>){
     
//    var getMethod = new GetMethod("https://agilezen.com/api/v1/projects/${_project}/roles")
//    getMethod.addRequestHeader( "Content-Type", "application/xml" )
//  
//    var respcode =  httpClient.executeMethod( getMethod )
////    print ("Response code: " + respcode)
//    if (respcode != 200) Throw "HTTP : ${respcode} accessing AgileZen site"    
//    var resp =   getMethod.ResponseBody
//    var users =  Roles.parse( resp )
//    users.Items.Role.cast(Role)
     
    var tempmap = new HashMap<String, BigInteger>()
    storymap.eachValue( \  s -> _usermap.put( s?.Owner?.UserName, s?.Owner?.Id )) 
    _usermap.remove( null )
    _usermap.eachKeyAndValue( \ s, b -> tempmap.put(s, b)  )
    tempmap.eachKeyAndValue( \ s, b ->  { 
      var user = UserMapping.getValueByName( s )
      if (user == null) {}
      else {
        _usermap.put(user, b)
      }
    })
//    _usermap.eachKeyAndValue( \ s, b -> print("Username: ${s} ID: ${b}" ) )
   }
 
   private function getSubStories(jira: RemoteIssue) : RemoteIssue[] {
     
     return null
   }
   
   
   private  function cleancopy(story : Story) : Story {
     var newStory = new Story()
     newStory = story
     newStory.Milestones = null //clear out the milestones, not trying to set them
     newStory.Steps = null //clear out the steps, not trying to set them
     newStory.Phase.Name = null //clear out the Phase name, don't need it as the ID is really the key
//     print ("Phase is now ${newStory.Phase.Id}")
     
     return newStory
   } 
    
   private function setBaseFields (jira : RemoteIssue, usermap :  HashMap<String, BigInteger>, story : Story): Story {
        
    story.Text = "[${jira.Key}](http://jira/jira/browse/${jira.Key}) : ${jira.Summary}" //update the text, in case it changed
    story.Size = jira.getJiraEstimate() //update the estimate
    story.Priority =  jirapriority.getValueByName( jira.Priority ) //update the priority
//    print ("Jira Assignee = " + jira.Assignee)
    if ( null == jira.Assignee || jira.Assignee.equals(_UnassignedUser)) {
//        print ("Clearing out the owner")
        story.Owner.Id = null
        story.Owner.UserName = null
        story.Owner.Email = null
        //st.Owner.Name= ""
     } else {
        story.Owner.Email = null
        story.Owner.Name = null
        story.Owner.Id = usermap.get( jira.Assignee )
        story.Owner.UserName = jira.Assignee
     }
    //story.Color = getColor(jira) 
    //story.Tags
    return story
  }    
    
  private function getColor(jira : RemoteIssue) : Color {
    var color = Color.Grey
    
         
    return color
  }
 
    
}